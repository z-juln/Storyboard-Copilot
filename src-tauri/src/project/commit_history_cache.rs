use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::git_dto::ProjectGitCommitDto;

const CACHE_RELATIVE_DIR: &str = ".cache/commit-history";
const CACHE_FILE_NAME: &str = "commits.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitHistoryCacheFile {
    saved_at: i64,
    commits: Vec<ProjectGitCommitDto>,
}

pub fn cache_file_path(project_dir: &Path) -> PathBuf {
    project_dir.join(CACHE_RELATIVE_DIR).join(CACHE_FILE_NAME)
}

pub fn load_cached_commits(project_dir: &Path) -> Vec<ProjectGitCommitDto> {
    let path = cache_file_path(project_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return vec![];
    };
    serde_json::from_str::<CommitHistoryCacheFile>(&content)
        .map(|file| file.commits)
        .unwrap_or_default()
}

pub fn merge_commit_lists(
    primary: Vec<ProjectGitCommitDto>,
    secondary: Vec<ProjectGitCommitDto>,
) -> Vec<ProjectGitCommitDto> {
    let mut by_hash: HashMap<String, ProjectGitCommitDto> = HashMap::new();
    for commit in secondary {
        by_hash.insert(commit.hash.clone(), commit);
    }
    for commit in primary {
        by_hash.insert(commit.hash.clone(), commit);
    }

    let mut merged: Vec<ProjectGitCommitDto> = by_hash.into_values().collect();
    merged.sort_by(|left, right| right.committed_at.cmp(&left.committed_at));
    merged
}

pub fn save_commit_history_cache(
    project_dir: &Path,
    commits: &[ProjectGitCommitDto],
) -> Result<(), String> {
    let cache_dir = project_dir.join(CACHE_RELATIVE_DIR);
    fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("创建提交历史缓存目录失败: {err}"))?;

    let saved_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0);
    let payload = CommitHistoryCacheFile {
        saved_at,
        commits: commits.to_vec(),
    };
    let json = serde_json::to_string_pretty(&payload)
        .map_err(|err| format!("序列化提交历史缓存失败: {err}"))?;
    fs::write(cache_file_path(project_dir), json)
        .map_err(|err| format!("写入提交历史缓存失败: {err}"))?;
    Ok(())
}

pub fn clear_commit_history_cache(project_dir: &Path) -> Result<(), String> {
    let path = cache_file_path(project_dir);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|err| format!("清除提交历史缓存失败: {err}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_commit(hash: &str, committed_at: &str) -> ProjectGitCommitDto {
        ProjectGitCommitDto {
            hash: hash.to_string(),
            short_hash: hash.chars().take(7).collect(),
            message: "msg".to_string(),
            committed_at: committed_at.to_string(),
        }
    }

    #[test]
    fn merge_commit_lists_dedupes_and_sorts_desc() {
        let primary = vec![
            sample_commit("aaa", "2026-01-03T00:00:00Z"),
            sample_commit("bbb", "2026-01-02T00:00:00Z"),
        ];
        let secondary = vec![
            sample_commit("bbb", "2026-01-02T00:00:00Z"),
            sample_commit("ccc", "2026-01-04T00:00:00Z"),
        ];

        let merged = merge_commit_lists(primary, secondary);
        assert_eq!(
            merged.iter().map(|item| item.hash.as_str()).collect::<Vec<_>>(),
            vec!["ccc", "aaa", "bbb"]
        );
    }
}
