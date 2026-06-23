use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPluginStatusDto {
    pub available: bool,
    pub version: Option<String>,
    pub install_hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitStatusDto {
    pub initialized: bool,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub dirty: bool,
    pub commit_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitStorageDto {
    pub total_bytes: u64,
    pub worktree_bytes: u64,
    pub git_bytes: u64,
    pub updated_at: i64,
    pub exceeds_one_gb: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitChangeDto {
    pub path: String,
    pub kind: String,
    pub old_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitCommitDto {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub committed_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitCommitsDto {
    pub commits: Vec<ProjectGitCommitDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitChangesDto {
    pub changes: Vec<ProjectGitChangeDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitBlobDto {
    pub kind: String,
    pub text: Option<String>,
    pub base64: Option<String>,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitCommitRequestDto {
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitCheckoutRequestDto {
    pub commit: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGitRevertRequestDto {
    pub path: String,
    pub kind: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectGitBlobQuery {
    pub commit: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectGitCommitsQuery {
    pub limit: Option<u32>,
}
