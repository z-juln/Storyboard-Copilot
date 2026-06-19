use std::collections::HashMap;

use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::ai::dto::{ModelCallResultDto, ModelInvokeInputDto, ModelOutputDto, ModelTaskDto};
use crate::ai::error::AIError;

const BASE_URL: &str = "https://api-beijing.klingai.com";
const MODEL_NAME: &str = "kling-v3";

#[derive(Debug, Deserialize)]
struct KlingEnvelope<T> {
    code: Option<i64>,
    message: Option<String>,
    data: Option<T>,
}

#[derive(Debug, Deserialize)]
struct KlingSubmitData {
    task_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KlingTaskData {
    task_status: Option<String>,
    task_result: Option<KlingTaskResult>,
}

#[derive(Debug, Deserialize)]
struct KlingTaskResult {
    videos: Option<Vec<KlingVideoItem>>,
}

#[derive(Debug, Deserialize)]
struct KlingVideoItem {
    url: Option<String>,
}

pub async fn invoke_text_to_video(
    api_key: &str,
    input: ModelInvokeInputDto,
    params: Option<HashMap<String, Value>>,
) -> Result<ModelCallResultDto, AIError> {
    let prompt = input
        .prompt
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AIError::InvalidRequest("缺少 prompt".to_string()))?;

    let aspect_ratio = input
        .aspect_ratio
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "16:9".to_string());

    let duration = params
        .as_ref()
        .and_then(|map| map.get("duration"))
        .and_then(|value| match value {
            Value::String(text) => Some(text.clone()),
            Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
        .unwrap_or_else(|| "5".to_string());

    let mut body = json!({
        "model_name": MODEL_NAME,
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
        "mode": "std"
    });

    if let Some(extra) = params {
        if let Some(obj) = body.as_object_mut() {
            for (key, value) in extra {
                if key != "duration" {
                    obj.insert(key.clone(), value.clone());
                }
            }
        }
    }

    let client = Client::new();
    let response = client
        .post(format!("{BASE_URL}/v1/videos/text2video"))
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?;

    let status = response.status();
    let raw: Value = response
        .json()
        .await
        .map_err(|err| AIError::Provider(format!("解析 Kling 响应失败: {err}")))?;

    if !status.is_success() {
        return Ok(ModelCallResultDto::Failed {
            error: format_kling_error(&raw, status.as_u16()),
            details: None,
            raw: Some(raw),
        });
    }

    let parsed: KlingEnvelope<KlingSubmitData> = serde_json::from_value(raw.clone())
        .map_err(|err| AIError::Provider(format!("解析 Kling 响应失败: {err}")))?;

    if parsed.code.unwrap_or(-1) != 0 {
        return Ok(ModelCallResultDto::Failed {
            error: parsed.message.unwrap_or_else(|| "Kling 提交任务失败".to_string()),
            details: None,
            raw: Some(raw),
        });
    }

    let task_id = parsed
        .data
        .and_then(|data| data.task_id)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AIError::Provider("Kling 未返回 task_id".to_string()))?;

    Ok(ModelCallResultDto::Queued {
        task: ModelTaskDto {
            id: task_id,
            poll_after_ms: Some(3000),
            provider_state: Some(json!({ "kind": "kling-text2video" })),
        },
        raw: Some(raw),
    })
}

pub async fn poll_text_to_video(
    api_key: &str,
    task: ModelTaskDto,
) -> Result<ModelCallResultDto, AIError> {
    let client = Client::new();
    let response = client
        .get(format!("{BASE_URL}/v1/videos/text2video/{}", task.id))
        .header("Authorization", format!("Bearer {api_key}"))
        .send()
        .await?;

    let status = response.status();
    let raw: Value = response
        .json()
        .await
        .map_err(|err| AIError::Provider(format!("解析 Kling 轮询响应失败: {err}")))?;

    if !status.is_success() {
        return Ok(ModelCallResultDto::Failed {
            error: format_kling_error(&raw, status.as_u16()),
            details: None,
            raw: Some(raw),
        });
    }

    let parsed: KlingEnvelope<KlingTaskData> = serde_json::from_value(raw.clone())
        .map_err(|err| AIError::Provider(format!("解析 Kling 轮询响应失败: {err}")))?;

    if parsed.code.unwrap_or(-1) != 0 {
        return Ok(ModelCallResultDto::Failed {
            error: parsed.message.unwrap_or_else(|| "Kling 查询任务失败".to_string()),
            details: None,
            raw: Some(raw),
        });
    }

    let task_status = parsed
        .data
        .as_ref()
        .and_then(|data| data.task_status.as_deref())
        .unwrap_or("unknown")
        .to_ascii_lowercase();

    match task_status.as_str() {
        "submitted" | "processing" | "running" | "pending" => Ok(ModelCallResultDto::Running {
            task: ModelTaskDto {
                poll_after_ms: Some(3000),
                ..task
            },
            raw: Some(raw),
        }),
        "succeed" | "succeeded" | "success" | "completed" | "done" => {
            let url = parsed
                .data
                .and_then(|data| data.task_result)
                .and_then(|result| result.videos)
                .and_then(|videos| videos.into_iter().next())
                .and_then(|video| video.url)
                .filter(|value| !value.trim().is_empty());

            if let Some(url) = url {
                Ok(ModelCallResultDto::Succeeded {
                    outputs: vec![ModelOutputDto::Video { url: Some(url) }],
                    raw: Some(raw),
                })
            } else {
                Ok(ModelCallResultDto::Failed {
                    error: "Kling 任务成功但未返回视频 URL".to_string(),
                    details: None,
                    raw: Some(raw),
                })
            }
        }
        "failed" | "error" => Ok(ModelCallResultDto::Failed {
            error: parsed
                .message
                .unwrap_or_else(|| "Kling 视频生成失败".to_string()),
            details: None,
            raw: Some(raw),
        }),
        other => Ok(ModelCallResultDto::Running {
            task: ModelTaskDto {
                poll_after_ms: Some(3000),
                ..task
            },
            raw: Some(json!({ "taskStatus": other, "body": raw })),
        }),
    }
}

fn format_kling_error(raw: &Value, status: u16) -> String {
    if let Ok(parsed) = serde_json::from_value::<KlingEnvelope<Value>>(raw.clone()) {
        if let Some(message) = parsed.message.filter(|value| !value.trim().is_empty()) {
            return message;
        }
    }
    format!("Kling 请求失败，HTTP {status}")
}
