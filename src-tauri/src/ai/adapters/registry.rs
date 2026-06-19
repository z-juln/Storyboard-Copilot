use std::collections::HashMap;
use std::path::Path;

use serde_json::Value;

use crate::ai::adapters::builtin::{deepseek, kling};
use crate::ai::dto::{
    BuiltinAdapterSummaryDto, ModelCallResultDto, ModelInvokeInputDto, ModelTaskDto,
};
use crate::ai::error::AIError;
use crate::ai::secrets::{self, DEEPSEEK_PROVIDER_ID, KLING_PROVIDER_ID};

pub const DEEPSEEK_FLASH_ADAPTER_ID: &str = "deepseek/deepseek-v4-flash/chat";
pub const KLING_V3_T2V_ADAPTER_ID: &str = "kling/kling-v3/text-to-video";

#[derive(Debug, Clone)]
pub struct BuiltinAdapterDefinition {
    pub id: &'static str,
    pub display_name: &'static str,
    pub capability: &'static str,
    pub provider_id: &'static str,
    pub model_id: &'static str,
}

const BUILTIN_ADAPTERS: [BuiltinAdapterDefinition; 2] = [
    BuiltinAdapterDefinition {
        id: DEEPSEEK_FLASH_ADAPTER_ID,
        display_name: "DeepSeek V4 Flash / Chat",
        capability: "chat",
        provider_id: DEEPSEEK_PROVIDER_ID,
        model_id: "deepseek/deepseek-v4-flash",
    },
    BuiltinAdapterDefinition {
        id: KLING_V3_T2V_ADAPTER_ID,
        display_name: "Kling 3.0 / 文生视频",
        capability: "text-to-video",
        provider_id: KLING_PROVIDER_ID,
        model_id: "kling/kling-v3",
    },
];

pub fn list_builtin_adapters() -> Vec<BuiltinAdapterSummaryDto> {
    BUILTIN_ADAPTERS
        .iter()
        .map(|adapter| BuiltinAdapterSummaryDto {
            id: adapter.id.to_string(),
            display_name: adapter.display_name.to_string(),
            capability: adapter.capability.to_string(),
            provider_id: adapter.provider_id.to_string(),
            model_id: adapter.model_id.to_string(),
            locked: true,
        })
        .collect()
}

fn find_adapter(adapter_id: &str) -> Option<&'static BuiltinAdapterDefinition> {
    BUILTIN_ADAPTERS
        .iter()
        .find(|adapter| adapter.id == adapter_id)
}

fn resolve_key(db_path: &Path, provider_id: &str) -> Result<String, AIError> {
    let conn = secrets::open_secrets_db(db_path)
        .map_err(|err| AIError::Provider(format!("打开密钥存储失败: {err}")))?;
    secrets::resolve_api_key(&conn, provider_id).ok_or_else(|| {
        AIError::InvalidRequest(format!("provider {provider_id} 缺少可用 API Key"))
    })
}

pub async fn invoke_adapter(
    db_path: &Path,
    adapter_id: &str,
    input: ModelInvokeInputDto,
    params: Option<HashMap<String, Value>>,
) -> Result<ModelCallResultDto, AIError> {
    let adapter = find_adapter(adapter_id).ok_or_else(|| {
        AIError::InvalidRequest(format!("未知内置 Adapter: {adapter_id}"))
    })?;
    let api_key = resolve_key(db_path, adapter.provider_id)?;

    match adapter.id {
        DEEPSEEK_FLASH_ADAPTER_ID => deepseek::invoke_chat(&api_key, input, params).await,
        KLING_V3_T2V_ADAPTER_ID => kling::invoke_text_to_video(&api_key, input, params).await,
        _ => Err(AIError::InvalidRequest(format!(
            "未实现的 Adapter: {adapter_id}"
        ))),
    }
}

pub async fn poll_adapter(
    db_path: &Path,
    adapter_id: &str,
    task: ModelTaskDto,
) -> Result<ModelCallResultDto, AIError> {
    let adapter = find_adapter(adapter_id).ok_or_else(|| {
        AIError::InvalidRequest(format!("未知内置 Adapter: {adapter_id}"))
    })?;
    let api_key = resolve_key(db_path, adapter.provider_id)?;

    match adapter.id {
        KLING_V3_T2V_ADAPTER_ID => kling::poll_text_to_video(&api_key, task).await,
        _ => Err(AIError::InvalidRequest(format!(
            "Adapter {adapter_id} 不支持轮询"
        ))),
    }
}
