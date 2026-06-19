use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInvokeInputDto {
    pub prompt: Option<String>,
    pub messages: Option<Vec<ChatMessageDto>>,
    pub aspect_ratio: Option<String>,
    pub size: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessageDto {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvokeModelAdapterRequestDto {
    pub adapter_id: String,
    pub input: ModelInvokeInputDto,
    pub params: Option<HashMap<String, Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollModelAdapterRequestDto {
    pub adapter_id: String,
    pub task: ModelTaskDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ModelOutputDto {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        url: Option<String>,
        #[serde(rename = "dataUrl")]
        data_url: Option<String>,
    },
    #[serde(rename = "video")]
    Video { url: Option<String> },
    #[serde(rename = "audio")]
    Audio {
        url: Option<String>,
        #[serde(rename = "dataUrl")]
        data_url: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum ModelCallResultDto {
    #[serde(rename = "succeeded")]
    Succeeded {
        outputs: Vec<ModelOutputDto>,
        raw: Option<Value>,
    },
    #[serde(rename = "queued", rename_all = "camelCase")]
    Queued {
        task: ModelTaskDto,
        raw: Option<Value>,
    },
    #[serde(rename = "running", rename_all = "camelCase")]
    Running {
        task: ModelTaskDto,
        raw: Option<Value>,
    },
    #[serde(rename = "failed")]
    Failed {
        error: String,
        details: Option<String>,
        raw: Option<Value>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelTaskDto {
    pub id: String,
    pub poll_after_ms: Option<u64>,
    pub provider_state: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinAdapterSummaryDto {
    pub id: String,
    pub display_name: String,
    pub capability: String,
    pub provider_id: String,
    pub model_id: String,
    pub locked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSecretStatusDto {
    pub provider_id: String,
    pub has_override: bool,
    pub has_builtin: bool,
    pub using_builtin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetProviderSecretRequestDto {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponseDto {
    pub status: String,
    pub version: String,
}
