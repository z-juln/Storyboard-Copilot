use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use super::git_dto::ProjectGitStorageDto;

const ONE_GIB: u64 = 1_073_741_824;
const CACHE_TTL: Duration = Duration::from_secs(5);

static STORAGE_CACHE: LazyLock<Mutex<HashMap<String, (Instant, ProjectGitStorageDto)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn measure_project_storage(
    project_id: &str,
    project_dir: &Path,
) -> Result<ProjectGitStorageDto, String> {
    if let Ok(cache) = STORAGE_CACHE.lock() {
        if let Some((cached_at, snapshot)) = cache.get(project_id) {
            if cached_at.elapsed() < CACHE_TTL {
                return Ok(snapshot.clone());
            }
        }
    }

    let (worktree_bytes, git_bytes) = sum_project_directory_sizes(project_dir)?;
    let total_bytes = worktree_bytes.saturating_add(git_bytes);
    let snapshot = ProjectGitStorageDto {
        total_bytes,
        worktree_bytes,
        git_bytes,
        updated_at: current_millis(),
        exceeds_one_gb: total_bytes > ONE_GIB,
    };

    if let Ok(mut cache) = STORAGE_CACHE.lock() {
        cache.insert(project_id.to_string(), (Instant::now(), snapshot.clone()));
    }

    Ok(snapshot)
}

pub fn invalidate_project_storage_cache(project_id: &str) {
    if let Ok(mut cache) = STORAGE_CACHE.lock() {
        cache.remove(project_id);
    }
}

fn sum_project_directory_sizes(project_dir: &Path) -> Result<(u64, u64), String> {
    if !project_dir.is_dir() {
        return Err("项目目录不存在".to_string());
    }

    let mut worktree_bytes = 0u64;
    let mut git_bytes = 0u64;

    let entries = fs::read_dir(project_dir)
        .map_err(|err| format!("读取项目目录失败: {err}"))?;

    for entry in entries {
        let entry = entry.map_err(|err| format!("读取目录项失败: {err}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" {
            git_bytes = git_bytes.saturating_add(sum_path_bytes(&path)?);
            continue;
        }
        worktree_bytes = worktree_bytes.saturating_add(sum_path_bytes(&path)?);
    }

    Ok((worktree_bytes, git_bytes))
}

fn sum_path_bytes(path: &Path) -> Result<u64, String> {
    let metadata = fs::metadata(path).map_err(|err| format!("读取文件信息失败: {err}"))?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    if !metadata.is_dir() {
        return Ok(0);
    }

    let mut total = 0u64;
    let entries = fs::read_dir(path).map_err(|err| format!("读取目录失败: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("读取目录项失败: {err}"))?;
        total = total.saturating_add(sum_path_bytes(&entry.path())?);
    }
    Ok(total)
}

fn current_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0)
}
