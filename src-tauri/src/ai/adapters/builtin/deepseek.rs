use std::collections::HashMap;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::dto::{ModelCallResultDto, ModelInvokeInputDto, ModelOutputDto};
use crate::ai::error::AIError;

const BASE_URL: &str = "https://api.deepseek.com";
const MODEL_NAME: &str = "deepseek-v4-flash";

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

pub async fn invoke_chat(
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
            body.insert(key, value);
        }
    }

    let client = Client::new();
    let response = client
        .post(format!("{BASE_URL}/chat/completions"))
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
