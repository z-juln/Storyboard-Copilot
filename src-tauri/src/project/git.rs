use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::commit_history_cache::{
    clear_commit_history_cache, load_cached_commits, merge_commit_lists,
    save_commit_history_cache,
};
use super::git_dto::{
    GitPluginStatusDto, ProjectGitBlobDto, ProjectGitChangeDto, ProjectGitCommitDto,
    ProjectGitCommitsDto, ProjectGitChangesDto, ProjectGitStatusDto,
};
use super::storage::invalidate_project_storage_cache;

const DEFAULT_GITIGNORE: &str = ".cache/\n";

pub fn git_plugin_status() -> GitPluginStatusDto {
    match Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let version = version_text
                .strip_prefix("git version ")
                .map(|value| value.trim().to_string());
            let major_ok = version
                .as_deref()
                .and_then(|value| value.split('.').next())
                .and_then(|value| value.parse::<u32>().ok())
                .map(|value| value >= 2)
                .unwrap_or(true);
            GitPluginStatusDto {
                available: major_ok,
                version,
                install_hint: install_hint(),
            }
        }
        _ => GitPluginStatusDto {
            available: false,
            version: None,
            install_hint: install_hint(),
        },
    }
}

fn install_hint() -> String {
    if cfg!(target_os = "macos") {
        "请安装 Xcode Command Line Tools（终端执行 xcode-select --install），或通过 Homebrew 安装：brew install git".to_string()
    } else if cfg!(target_os = "windows") {
        "请从 https://git-scm.com/download/win 安装 Git，并确保 git 已加入 PATH".to_string()
    } else {
        "请通过系统包管理器安装 git（例如 apt install git / dnf install git），并确保 git 已在 PATH 中".to_string()
    }
}

pub fn init_repo(project_id: &str, project_dir: &Path) -> Result<(), String> {
    ensure_project_dir(project_dir)?;
    if !project_dir.join(".git").exists() {
        run_git(project_dir, &["init"])?;
    }
    ensure_gitignore(project_dir)?;
    invalidate_project_storage_cache(project_id);
    Ok(())
}

pub fn project_status(project_dir: &Path) -> Result<ProjectGitStatusDto, String> {
    ensure_project_dir(project_dir)?;
    let initialized = project_dir.join(".git").exists();
    if !initialized {
        return Ok(ProjectGitStatusDto {
            initialized: false,
            branch: None,
            head: None,
            dirty: false,
            commit_count: 0,
        });
    }

    let branch = run_git_optional(project_dir, &["branch", "--show-current"])?;
    let head = run_git_optional(project_dir, &["rev-parse", "HEAD"]).ok().flatten();
    let commit_count = run_git_optional(project_dir, &["rev-list", "--count", "HEAD"])
        .ok()
        .flatten()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    let dirty = !run_git(project_dir, &["status", "--porcelain"])?.trim().is_empty();

    Ok(ProjectGitStatusDto {
        initialized: true,
        branch,
        head,
        dirty,
        commit_count,
    })
}

pub fn list_commits(project_dir: &Path, limit: u32) -> Result<ProjectGitCommitsDto, String> {
    ensure_repo(project_dir)?;
    let git_commits = fetch_git_log_commits(project_dir)?;
    let cached_commits = load_cached_commits(project_dir);
    let merged = merge_commit_lists(git_commits, cached_commits);
    let limit = limit.clamp(1, 200) as usize;
    let commits = merged.into_iter().take(limit).collect();
    Ok(ProjectGitCommitsDto { commits })
}

fn fetch_git_log_commits(project_dir: &Path) -> Result<Vec<ProjectGitCommitDto>, String> {
    let count = run_git_optional(project_dir, &["rev-list", "--count", "HEAD"])
        .ok()
        .flatten()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    if count == 0 {
        return Ok(vec![]);
    }

    let output = run_git(
        project_dir,
        &["log", "--pretty=format:%H%x1f%s%x1f%cI"],
    )?;
    Ok(output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(parse_commit_line)
        .collect())
}

fn snapshot_commit_history(project_dir: &Path) -> Result<(), String> {
    let git_commits = fetch_git_log_commits(project_dir)?;
    let cached_commits = load_cached_commits(project_dir);
    let merged = merge_commit_lists(git_commits, cached_commits);
    if merged.is_empty() {
        return Ok(());
    }
    save_commit_history_cache(project_dir, &merged)
}

fn parse_commit_line(line: &str) -> Option<ProjectGitCommitDto> {
    let mut parts = line.splitn(3, '\x1f');
    let hash = parts.next()?.trim().to_string();
    if hash.is_empty() {
        return None;
    }
    let message = parts.next().unwrap_or("").trim().to_string();
    let committed_at = parts.next().unwrap_or("").trim().to_string();
    let short_hash = hash.chars().take(7).collect();
    Some(ProjectGitCommitDto {
        hash,
        short_hash,
        message,
        committed_at,
    })
}

pub fn list_changes(project_dir: &Path) -> Result<ProjectGitChangesDto, String> {
    ensure_repo(project_dir)?;
    let output = run_git_bytes(project_dir, &["status", "--porcelain", "-z", "-uall"])?;
    let changes = parse_porcelain_z_output(&output);
    let changes = filter_directory_changes(project_dir, changes);
    Ok(ProjectGitChangesDto { changes })
}

fn parse_porcelain_z_output(output: &[u8]) -> Vec<ProjectGitChangeDto> {
    let entries: Vec<&[u8]> = output
        .split(|byte| *byte == 0)
        .filter(|entry| !entry.is_empty())
        .collect();

    let mut changes = Vec::new();
    let mut index = 0;
    while index < entries.len() {
        let Some((status, path)) = parse_porcelain_status_entry(entries[index]) else {
            index += 1;
            continue;
        };

        if is_rename_status(&status)
            && index + 1 < entries.len()
            && !is_porcelain_status_entry(entries[index + 1])
        {
            changes.push(ProjectGitChangeDto {
                path: normalize_change_path(&path),
                kind: "renamed".to_string(),
                old_path: Some(parse_path_bytes(entries[index + 1])),
            });
            index += 2;
            continue;
        }

        changes.push(ProjectGitChangeDto {
            path: normalize_change_path(&path),
            kind: map_status_kind(&status).to_string(),
            old_path: None,
        });
        index += 1;
    }

    changes
}

fn parse_porcelain_status_entry(entry: &[u8]) -> Option<(String, String)> {
    let text = std::str::from_utf8(entry).ok()?;
    if text.len() < 4 || text.as_bytes().get(2) != Some(&b' ') {
        return None;
    }
    let status = text.get(0..2)?.trim().to_string();
    let path = text.get(3..)?.trim().to_string();
    if path.is_empty() {
        return None;
    }
    Some((status, path))
}

fn is_porcelain_status_entry(entry: &[u8]) -> bool {
    parse_porcelain_status_entry(entry).is_some()
}

fn parse_path_bytes(entry: &[u8]) -> String {
    std::str::from_utf8(entry)
        .map(normalize_change_path)
        .unwrap_or_default()
}

fn is_rename_status(status: &str) -> bool {
    status == "R" || status == "RM"
}

fn map_status_kind(status: &str) -> &'static str {
    match status {
        "??" => "added",
        "A" | "AM" => "added",
        "M" | "MM" | " T" | "T " => "modified",
        "D" | " D" => "deleted",
        "R" | "RM" => "renamed",
        _ if status.contains('M') => "modified",
        _ if status.contains('D') => "deleted",
        _ if status.contains('A') => "added",
        _ => "modified",
    }
}

fn normalize_change_path(path: &str) -> String {
    path.trim().trim_end_matches('/').replace('\\', "/")
}

/// 仅展示文件级变更：去掉目录本身条目，保留目录下具体文件。
fn filter_directory_changes(
    project_dir: &Path,
    changes: Vec<ProjectGitChangeDto>,
) -> Vec<ProjectGitChangeDto> {
    if changes.is_empty() {
        return changes;
    }

    let normalized_paths: Vec<String> = changes
        .iter()
        .map(|change| normalize_change_path(&change.path))
        .collect();

    changes
        .into_iter()
        .filter(|change| {
            let path = normalize_change_path(&change.path);
            if path.is_empty() {
                return false;
            }

            let has_descendant = normalized_paths.iter().any(|other| {
                other != &path && other.starts_with(&format!("{path}/"))
            });
            if has_descendant {
                return false;
            }

            let full_path = project_dir.join(&path);
            full_path.is_file() || (!full_path.exists() && !full_path.is_dir())
        })
        .map(|change| ProjectGitChangeDto {
            path: normalize_change_path(&change.path),
            kind: change.kind,
            old_path: change
                .old_path
                .as_ref()
                .map(|value| normalize_change_path(value)),
        })
        .collect()
}

pub fn commit_all(project_id: &str, project_dir: &Path, message: &str) -> Result<(), String> {
    ensure_repo(project_dir)?;
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("提交说明不能为空".to_string());
    }
    run_git(project_dir, &["add", "-A"])?;
    run_git(project_dir, &["commit", "-m", trimmed])?;
    invalidate_project_storage_cache(project_id);
    Ok(())
}

pub fn keep_current_version(project_id: &str, project_dir: &Path) -> Result<(), String> {
    ensure_repo(project_dir)?;
    let count = run_git(project_dir, &["rev-list", "--count", "HEAD"])?
        .trim()
        .parse::<u32>()
        .unwrap_or(0);
    if count == 0 {
        return Err("尚无提交记录".to_string());
    }

    let cached = load_cached_commits(project_dir);
    if count == 1 && cached.is_empty() {
        return Err("当前已仅有一个版本".to_string());
    }

    if count > 1 {
        squash_history_to_current(project_dir)?;
    }
    clear_commit_history_cache(project_dir)?;
    prune_unreachable_git_objects(project_dir);
    invalidate_project_storage_cache(project_id);
    Ok(())
}

fn squash_history_to_current(project_dir: &Path) -> Result<(), String> {
    const TEMP_BRANCH: &str = "__keep_current__";
    let branch = run_git_optional(project_dir, &["branch", "--show-current"])?
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "main".to_string());
    let message = run_git_optional(project_dir, &["log", "-1", "--pretty=%s"])?
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "仅保留当前版本".to_string());

    run_git(project_dir, &["checkout", "--orphan", TEMP_BRANCH])?;
    run_git(project_dir, &["add", "-A"])?;
    run_git(project_dir, &["commit", "-m", &message])?;
    if branch != TEMP_BRANCH {
        let _ = run_git(project_dir, &["branch", "-D", &branch]);
    }
    run_git(project_dir, &["branch", "-m", &branch])?;
    Ok(())
}

fn prune_unreachable_git_objects(project_dir: &Path) {
    let _ = run_git(project_dir, &["reflog", "expire", "--expire=now", "--all"]);
    let _ = run_git(project_dir, &["gc", "--prune=now", "--quiet"]);
}

pub fn checkout_commit(project_id: &str, project_dir: &Path, commit: &str) -> Result<(), String> {
    ensure_repo(project_dir)?;
    let commit = commit.trim();
    if commit.is_empty() {
        return Err("commit 不能为空".to_string());
    }
    let resolved = run_git(project_dir, &["rev-parse", commit])?;
    let head = run_git_optional(project_dir, &["rev-parse", "HEAD"])?.unwrap_or_default();
    if !head.is_empty() && head != resolved {
        snapshot_commit_history(project_dir)?;
    }
    run_git(project_dir, &["reset", "--hard", &resolved])?;
    let _ = run_git(project_dir, &["clean", "-fd"]);
    invalidate_project_storage_cache(project_id);
    Ok(())
}

pub fn revert_change(
    project_id: &str,
    project_dir: &Path,
    path: &str,
    kind: &str,
    old_path: Option<&str>,
) -> Result<(), String> {
    ensure_repo(project_dir)?;
    let relative = validate_repo_relative_path(path)?;
    let full_path = project_dir.join(&relative);
    let has_head = run_git_optional(project_dir, &["rev-parse", "HEAD"])
        .ok()
        .flatten()
        .is_some();

    match kind {
        "added" => {
            if full_path.exists() {
                if full_path.is_dir() {
                    fs::remove_dir_all(&full_path)
                        .map_err(|err| format!("删除目录失败: {err}"))?;
                } else {
                    fs::remove_file(&full_path)
                        .map_err(|err| format!("删除文件失败: {err}"))?;
                }
            }
            let path_arg = relative.to_string_lossy();
            let _ = run_git(project_dir, &["rm", "-r", "--cached", "--force", path_arg.as_ref()]);
        }
        "deleted" if has_head => {
            let path_arg = relative.to_string_lossy();
            run_git(
                project_dir,
                &["restore", "--source=HEAD", "--worktree", "--", path_arg.as_ref()],
            )?;
        }
        "deleted" => {
            return Err("尚无提交记录，无法恢复已删除文件".to_string());
        }
        "renamed" if has_head => {
            let old = old_path
                .map(validate_repo_relative_path)
                .transpose()?
                .ok_or_else(|| "移动变更缺少原路径".to_string())?;
            if full_path.exists() {
                if full_path.is_dir() {
                    fs::remove_dir_all(&full_path)
                        .map_err(|err| format!("删除目录失败: {err}"))?;
                } else {
                    fs::remove_file(&full_path)
                        .map_err(|err| format!("删除文件失败: {err}"))?;
                }
            }
            let new_path_arg = relative.to_string_lossy();
            let _ = run_git(
                project_dir,
                &["rm", "-r", "--cached", "--force", new_path_arg.as_ref()],
            );
            let old_path_arg = old.to_string_lossy();
            run_git(
                project_dir,
                &[
                    "restore",
                    "--source=HEAD",
                    "--staged",
                    "--worktree",
                    "--",
                    old_path_arg.as_ref(),
                ],
            )?;
        }
        _ if has_head => {
            let path_arg = relative.to_string_lossy();
            run_git(
                project_dir,
                &[
                    "restore",
                    "--source=HEAD",
                    "--staged",
                    "--worktree",
                    "--",
                    path_arg.as_ref(),
                ],
            )?;
        }
        _ => {
            if full_path.exists() {
                if full_path.is_dir() {
                    fs::remove_dir_all(&full_path)
                        .map_err(|err| format!("删除目录失败: {err}"))?;
                } else {
                    fs::remove_file(&full_path)
                        .map_err(|err| format!("删除文件失败: {err}"))?;
                }
            }
        }
    }

    invalidate_project_storage_cache(project_id);
    Ok(())
}

pub fn read_blob(project_dir: &Path, commit: &str, path: &str) -> Result<ProjectGitBlobDto, String> {
    ensure_repo(project_dir)?;
    let relative = validate_repo_relative_path(path)?;
    let commit = commit.trim();
    if commit.is_empty() {
        return Err("commit 不能为空".to_string());
    }
    let spec = format!("{commit}:{}", relative.to_string_lossy());
    let output = Command::new("git")
        .current_dir(project_dir)
        .arg("show")
        .arg(&spec)
        .output()
        .map_err(|err| format!("读取 Git 对象失败: {err}"))?;
    if !output.status.success() {
        return Ok(ProjectGitBlobDto {
            kind: "missing".to_string(),
            text: None,
            base64: None,
            size: 0,
        });
    }

    let bytes = output.stdout;
    let size = bytes.len() as u64;
    if is_probably_text(&relative, &bytes) {
        let text = String::from_utf8(bytes)
            .map_err(|err| format!("解码文本失败: {err}"))?;
        Ok(ProjectGitBlobDto {
            kind: "text".to_string(),
            text: Some(text),
            base64: None,
            size,
        })
    } else {
        Ok(ProjectGitBlobDto {
            kind: "binary".to_string(),
            text: None,
            base64: Some(base64_encode(&bytes)),
            size,
        })
    }
}

fn is_probably_text(path: &Path, bytes: &[u8]) -> bool {
    if path.ends_with("project.json") {
        return true;
    }
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if name.ends_with(".txt")
        || name.ends_with(".md")
        || name.ends_with(".markdown")
        || name.ends_with(".json")
    {
        return true;
    }
    std::str::from_utf8(bytes).is_ok() && !bytes.contains(&0)
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn ensure_gitignore(project_dir: &Path) -> Result<(), String> {
    let path = project_dir.join(".gitignore");
    if !path.exists() {
        fs::write(&path, DEFAULT_GITIGNORE).map_err(|err| format!("写入 .gitignore 失败: {err}"))?;
        return Ok(());
    }
    let content =
        fs::read_to_string(&path).map_err(|err| format!("读取 .gitignore 失败: {err}"))?;
    if content.lines().any(|line| {
        let trimmed = line.trim();
        trimmed == ".cache" || trimmed == ".cache/"
    }) {
        return Ok(());
    }
    let mut next = content;
    if !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(".cache/\n");
    fs::write(&path, next).map_err(|err| format!("更新 .gitignore 失败: {err}"))?;
    Ok(())
}

fn ensure_project_dir(project_dir: &Path) -> Result<(), String> {
    if !project_dir.is_dir() {
        return Err("项目目录不存在".to_string());
    }
    Ok(())
}

fn ensure_repo(project_dir: &Path) -> Result<(), String> {
    ensure_project_dir(project_dir)?;
    if !project_dir.join(".git").exists() {
        return Err("Git 仓库尚未初始化".to_string());
    }
    Ok(())
}

fn validate_repo_relative_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty()
        || trimmed.starts_with('/')
        || trimmed.contains('\\')
        || trimmed.split('/').any(|segment| segment == "..")
    {
        return Err("非法文件路径".to_string());
    }
    Ok(PathBuf::from(trimmed))
}

fn run_git(project_dir: &Path, args: &[&str]) -> Result<String, String> {
    let bytes = run_git_bytes(project_dir, args)?;
    Ok(String::from_utf8_lossy(&bytes).trim_end().to_string())
}

fn run_git_bytes(project_dir: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .current_dir(project_dir)
        .args(args)
        .output()
        .map_err(|err| format!("执行 git 失败: {err}"))?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = if stderr.is_empty() {
        format!("git {} 失败", args.join(" "))
    } else {
        truncate_error(&stderr)
    };
    Err(message)
}

fn run_git_optional(project_dir: &Path, args: &[&str]) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .current_dir(project_dir)
        .args(args)
        .output()
        .map_err(|err| format!("执行 git 失败: {err}"))?;
    if output.status.success() {
        let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if value.is_empty() {
            Ok(None)
        } else {
            Ok(Some(value))
        }
    } else {
        Ok(None)
    }
}

fn truncate_error(message: &str) -> String {
    const MAX_LEN: usize = 240;
    if message.chars().count() <= MAX_LEN {
        return message.to_string();
    }
    message.chars().take(MAX_LEN).collect::<String>() + "…"
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_project_dir() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("storyboard-git-test-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp project dir");
        dir
    }

    #[test]
    fn filter_directory_changes_drops_parent_when_children_exist() {
        let project_dir = temp_project_dir();
        fs::create_dir_all(project_dir.join("assets/sub")).expect("mkdir");
        fs::write(project_dir.join("assets/sub/a.txt"), "a").expect("write");

        let changes = vec![
            ProjectGitChangeDto {
                path: "assets".to_string(),
                kind: "added".to_string(),
                old_path: None,
            },
            ProjectGitChangeDto {
                path: "assets/sub/a.txt".to_string(),
                kind: "added".to_string(),
                old_path: None,
            },
            ProjectGitChangeDto {
                path: "project.json".to_string(),
                kind: "modified".to_string(),
                old_path: None,
            },
        ];

        let filtered = filter_directory_changes(&project_dir, changes);
        let paths: Vec<_> = filtered.iter().map(|item| item.path.as_str()).collect();

        assert_eq!(paths, vec!["assets/sub/a.txt", "project.json"]);
        let _ = fs::remove_dir_all(&project_dir);
    }

    #[test]
    fn filter_directory_changes_drops_existing_directory_without_file() {
        let project_dir = temp_project_dir();
        fs::create_dir_all(project_dir.join("assets")).expect("mkdir");

        let changes = vec![ProjectGitChangeDto {
            path: "assets/".to_string(),
            kind: "added".to_string(),
            old_path: None,
        }];

        let filtered = filter_directory_changes(&project_dir, changes);
        assert!(filtered.is_empty());
        let _ = fs::remove_dir_all(&project_dir);
    }

    #[test]
    fn parse_porcelain_z_output_decodes_unicode_paths() {
        let mut output = Vec::new();
        output.extend_from_slice(
            b"?? assets/\xe8\xa7\x92\xe8\x89\xb2/\xe7\x89\x9b\xe9\x83\x8e/\xe4\xb8\x89\xe8\xa7\x86\xe5\x9b\xbe.png\0",
        );
        output.extend_from_slice(b"?? project.json\0");

        let changes = parse_porcelain_z_output(&output);
        assert_eq!(changes.len(), 2);
        assert_eq!(changes[0].path, "assets/角色/牛郎/三视图.png");
        assert_eq!(changes[0].kind, "added");
        assert_eq!(changes[1].path, "project.json");
    }

    #[test]
    fn parse_porcelain_z_output_parses_rename_pairs() {
        let output = b"R  new.txt\0old.txt\0";
        let changes = parse_porcelain_z_output(output);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "new.txt");
        assert_eq!(changes[0].kind, "renamed");
        assert_eq!(changes[0].old_path.as_deref(), Some("old.txt"));
    }
}
