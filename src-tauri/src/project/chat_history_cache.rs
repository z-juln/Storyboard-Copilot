use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::dto::ProjectChatHistorySnapshotDto;
use super::file_store;

const CACHE_RELATIVE_DIR: &str = ".cache/chat-history";
const CACHE_FILE_NAME: &str = "sessions.json";
const CACHE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChatHistoryCacheFile {
    version: u32,
    saved_at: i64,
    active_conversation_id: String,
    conversations: Vec<super::dto::ProjectChatHistoryConversationDto>,
}

pub fn cache_file_path(project_dir: &Path) -> PathBuf {
    project_dir.join(CACHE_RELATIVE_DIR).join(CACHE_FILE_NAME)
}

pub fn load_chat_history(project_dir: &Path) -> ProjectChatHistorySnapshotDto {
    let path = cache_file_path(project_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return ProjectChatHistorySnapshotDto::default();
    };

    serde_json::from_str::<ChatHistoryCacheFile>(&content)
        .map(|file| ProjectChatHistorySnapshotDto {
            active_conversation_id: file.active_conversation_id,
            conversations: file
                .conversations
                .into_iter()
                .filter(|conversation| !conversation.messages.is_empty())
                .collect(),
        })
        .unwrap_or_default()
}

pub fn save_chat_history(
    project_dir: &Path,
    snapshot: &ProjectChatHistorySnapshotDto,
) -> Result<(), String> {
    let cache_dir = project_dir.join(CACHE_RELATIVE_DIR);
    fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("创建对话历史缓存目录失败: {err}"))?;

    let saved_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0);
    let payload = ChatHistoryCacheFile {
        version: CACHE_VERSION,
        saved_at,
        active_conversation_id: snapshot.active_conversation_id.clone(),
        conversations: snapshot
            .conversations
            .iter()
            .filter(|conversation| !conversation.messages.is_empty())
            .cloned()
            .collect(),
    };
    let json = serde_json::to_string_pretty(&payload)
        .map_err(|err| format!("序列化对话历史失败: {err}"))?;
    fs::write(cache_file_path(project_dir), json)
        .map_err(|err| format!("写入对话历史失败: {err}"))?;
    Ok(())
}

pub fn load_chat_history_for_project(
    app_data_dir: &Path,
    project_id: &str,
) -> Result<ProjectChatHistorySnapshotDto, String> {
    let project_dir = file_store::resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("项目不存在: {project_id}"));
    }
    Ok(load_chat_history(&project_dir))
}

pub fn save_chat_history_for_project(
    app_data_dir: &Path,
    project_id: &str,
    snapshot: &ProjectChatHistorySnapshotDto,
) -> Result<(), String> {
    let project_dir = file_store::resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("项目不存在: {project_id}"));
    }
    save_chat_history(&project_dir, snapshot)
}
