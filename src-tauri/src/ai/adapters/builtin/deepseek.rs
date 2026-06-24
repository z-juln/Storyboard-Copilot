use std::collections::HashMap;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::dto::{ModelCallResultDto, ModelInvokeInputDto, ModelOutputDto};
use crate::ai::error::AIError;

const OPENAI_BASE_URL: &str = "https://api.deepseek.com";
const ANTHROPIC_BASE_URL: &str = "https://api.deepseek.com/anthropic/v1";
const MODEL_NAME: &str = "deepseek-v4-flash";
const WEB_SEARCH_TOOL_TYPE: &str = "web_search_20250305";
const DEFAULT_MAX_WEB_SEARCH_USES: u32 = 5;
const DEFAULT_MAX_TOKENS: u32 = 4096;

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Option<Vec<ChatChoice>>,
    error: Option<ChatError>,
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: Option<ChatChoiceMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatError {
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicMessageResponse {
    content: Option<Vec<AnthropicContentBlock>>,
    error: Option<AnthropicErrorBody>,
}

#[derive(Debug, Deserialize)]
struct AnthropicContentBlock {
    #[serde(rename = "type")]
    block_type: String,
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AnthropicErrorBody {
    message: Option<String>,
}

struct AnthropicConversation {
    system: Option<String>,
    messages: Vec<Value>,
}

fn build_messages(input: ModelInvokeInputDto) -> Result<Vec<serde_json::Value>, AIError> {
    if let Some(messages) = input.messages {
        if !messages.is_empty() {
            return Ok(messages
                .into_iter()
                .map(|message| {
                    json!({
                        "role": message.role,
                        "content": message.content,
                    })
                })
                .collect());
        }
    }

    let prompt = input
        .prompt
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AIError::InvalidRequest("缺少 prompt 或 messages".to_string()))?;

    Ok(vec![json!({ "role": "user", "content": prompt })])
}

fn build_anthropic_conversation(input: ModelInvokeInputDto) -> Result<AnthropicConversation, AIError> {
    let openai_messages = build_messages(input)?;
    let mut system = None;
    let mut messages = Vec::new();

    for message in openai_messages {
        let role = message
            .get("role")
            .and_then(|value| value.as_str())
            .unwrap_or("user");
        let content = message
            .get("content")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        if content.is_empty() {
            continue;
        }

        if role == "system" {
            system = Some(content);
            continue;
        }

        let anthropic_role = if role == "assistant" {
            "assistant"
        } else {
            "user"
        };

        messages.push(json!({
            "role": anthropic_role,
            "content": [{ "type": "text", "text": content }]
        }));
    }

    if messages.is_empty() {
        return Err(AIError::InvalidRequest("缺少 prompt 或 messages".to_string()));
    }

    Ok(AnthropicConversation { system, messages })
}

fn extract_anthropic_text(raw: &Value) -> Result<String, AIError> {
    let parsed: AnthropicMessageResponse = serde_json::from_value(raw.clone())
        .map_err(|err| AIError::Provider(format!("解析 DeepSeek 响应失败: {err}")))?;

    if let Some(error) = parsed.error.and_then(|item| item.message) {
        return Err(AIError::Provider(error));
    }

    let text = parsed
        .content
        .unwrap_or_default()
        .into_iter()
        .filter(|block| block.block_type == "text")
        .filter_map(|block| block.text)
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n");

    if text.is_empty() {
        return Err(AIError::Provider("模型未返回文本内容".to_string()));
    }

    Ok(text)
}

async fn invoke_chat_openai(
    api_key: &str,
    input: ModelInvokeInputDto,
    params: Option<HashMap<String, Value>>,
) -> Result<ModelCallResultDto, AIError> {
    let messages = build_messages(input)?;
    let mut body = serde_json::Map::new();
    body.insert("model".to_string(), Value::String(MODEL_NAME.to_string()));
    body.insert("messages".to_string(), Value::Array(messages));
    body.insert("stream".to_string(), Value::Bool(false));
    body.insert(
        "thinking".to_string(),
        json!({ "type": "disabled" }),
    );

    if let Some(extra) = params {
        for (key, value) in extra {
            if key == "enable_web_search" {
                continue;
            }
            body.insert(key, value);
        }
    }

    let client = Client::new();
    let response = client
        .post(format!("{OPENAI_BASE_URL}/chat/completions"))
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&Value::Object(body))
        .send()
        .await?;

    let status = response.status();
    let raw: Value = response
        .json()
        .await
        .map_err(|err| AIError::Provider(format!("解析 DeepSeek 响应失败: {err}")))?;

    if !status.is_success() {
        let parsed: ChatCompletionResponse = serde_json::from_value(raw.clone()).unwrap_or(
            ChatCompletionResponse {
                choices: None,
                error: None,
                message: None,
            },
        );
        let error = parsed
            .error
            .and_then(|item| item.message)
            .or(parsed.message)
            .unwrap_or_else(|| format!("DeepSeek 请求失败，HTTP {status}"));
        return Ok(ModelCallResultDto::Failed {
            error,
            details: None,
            raw: Some(raw),
        });
    }

    let parsed: ChatCompletionResponse = serde_json::from_value(raw.clone())
        .map_err(|err| AIError::Provider(format!("解析 DeepSeek 响应失败: {err}")))?;

    let text = parsed
        .choices
        .and_then(|choices| choices.into_iter().next())
        .and_then(|choice| choice.message)
        .and_then(|message| message.content)
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| AIError::Provider("模型未返回文本内容".to_string()))?;

    Ok(ModelCallResultDto::Succeeded {
        outputs: vec![ModelOutputDto::Text { text }],
        raw: Some(raw),
    })
}

async fn invoke_chat_with_web_search(
    api_key: &str,
    input: ModelInvokeInputDto,
) -> Result<ModelCallResultDto, AIError> {
    let conversation = build_anthropic_conversation(input)?;
    let mut body = serde_json::Map::new();
    body.insert("model".to_string(), Value::String(MODEL_NAME.to_string()));
    body.insert(
        "max_tokens".to_string(),
        Value::Number(DEFAULT_MAX_TOKENS.into()),
    );
    body.insert("messages".to_string(), Value::Array(conversation.messages));
    body.insert(
        "thinking".to_string(),
        json!({ "type": "disabled" }),
    );
    body.insert(
        "tools".to_string(),
        json!([{
            "type": WEB_SEARCH_TOOL_TYPE,
            "name": "web_search",
            "max_uses": DEFAULT_MAX_WEB_SEARCH_USES
        }]),
    );
    // auto：日期类问题不强制搜索（搜「今天日期」常返回函数文档导致幻觉）；新闻等由模型自行调用
    body.insert("tool_choice".to_string(), json!({ "type": "auto" }));

    if let Some(system) = conversation.system {
        body.insert("system".to_string(), Value::String(system));
    }

    let client = Client::new();
    let response = client
        .post(format!("{ANTHROPIC_BASE_URL}/messages"))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&Value::Object(body))
        .send()
        .await?;

    let status = response.status();
    let raw: Value = response
        .json()
        .await
        .map_err(|err| AIError::Provider(format!("解析 DeepSeek 响应失败: {err}")))?;

    if !status.is_success() {
        let error = raw
            .pointer("/error/message")
            .and_then(|value| value.as_str())
            .or_else(|| raw.get("message").and_then(|value| value.as_str()))
            .unwrap_or(&format!("DeepSeek 联网请求失败，HTTP {status}"))
            .to_string();
        return Ok(ModelCallResultDto::Failed {
            error,
            details: None,
            raw: Some(raw),
        });
    }

    let text = extract_anthropic_text(&raw)?;

    Ok(ModelCallResultDto::Succeeded {
        outputs: vec![ModelOutputDto::Text { text }],
        raw: Some(raw),
    })
}

/// DeepSeek 的 OpenAI `/chat/completions` 不支持联网，知识截止约 2025-05。
/// 联网必须走 Anthropic 兼容 API + `web_search` 工具；内置对话默认始终使用该路径。
pub async fn invoke_chat(
    api_key: &str,
    input: ModelInvokeInputDto,
    params: Option<HashMap<String, Value>>,
) -> Result<ModelCallResultDto, AIError> {
    let disable_web_search = params
        .as_ref()
        .and_then(|extra| extra.get("enable_web_search"))
        .and_then(|value| value.as_bool())
        == Some(false);

    if disable_web_search {
        tracing::info!("deepseek chat: web search explicitly disabled, using openai path");
        return invoke_chat_openai(api_key, input, params).await;
    }

    tracing::info!("deepseek chat: using anthropic web_search path");
    invoke_chat_with_web_search(api_key, input).await
}
