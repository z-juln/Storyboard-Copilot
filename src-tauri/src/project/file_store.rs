use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::dto::{ProjectDirectoryEntry, ProjectSnapshot, ProjectSummaryRecord};

const PROJECT_JSON: &str = "project.json";
const ASSETS_DIR: &str = "assets";

pub fn resolve_projects_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("projects")
}

pub fn resolve_project_dir(app_data_dir: &Path, project_id: &str) -> PathBuf {
    resolve_projects_root(app_data_dir).join(project_id)
}

pub fn resolve_project_json_path(app_data_dir: &Path, project_id: &str) -> PathBuf {
    resolve_project_dir(app_data_dir, project_id).join(PROJECT_JSON)
}

pub fn resolve_project_assets_dir(app_data_dir: &Path, project_id: &str) -> Result<PathBuf, String> {
    let assets_dir = resolve_project_dir(app_data_dir, project_id).join(ASSETS_DIR);
    fs::create_dir_all(&assets_dir)
        .map_err(|err| format!("Failed to create project assets dir: {err}"))?;
    Ok(assets_dir)
}

pub fn ensure_projects_root(app_data_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(resolve_projects_root(app_data_dir))
        .map_err(|err| format!("Failed to create projects root: {err}"))
}

pub fn list_project_summaries(app_data_dir: &Path) -> Result<Vec<ProjectSummaryRecord>, String> {
    ensure_projects_root(app_data_dir)?;
    let root = resolve_projects_root(app_data_dir);
    let mut summaries = Vec::new();

    let entries = fs::read_dir(&root).map_err(|err| format!("Failed to read projects root: {err}"))?;
    for entry_result in entries {
        let entry = entry_result.map_err(|err| format!("Failed to read project entry: {err}"))?;
        if !entry.file_type().map_err(|err| format!("Failed to read entry type: {err}"))?.is_dir() {
            continue;
        }

        let _project_id = entry.file_name().to_string_lossy().to_string();
        let json_path = entry.path().join(PROJECT_JSON);
        if !json_path.is_file() {
            continue;
        }

        let snapshot = match read_project_snapshot_file(&json_path) {
            Ok(snapshot) => snapshot,
            Err(err) => {
                tracing::warn!(
                    project = %entry.file_name().to_string_lossy(),
                    path = %json_path.display(),
                    "{err}; skip listing this project"
                );
                continue;
            }
        };
        summaries.push(ProjectSummaryRecord {
            id: snapshot.id,
            name: snapshot.name,
            created_at: snapshot.created_at,
            updated_at: snapshot.updated_at,
            node_count: snapshot.node_count,
        });
    }

    summaries.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    Ok(summaries)
}

pub fn get_project_snapshot(
    app_data_dir: &Path,
    project_id: &str,
) -> Result<Option<ProjectSnapshot>, String> {
    let json_path = resolve_project_json_path(app_data_dir, project_id);
    if !json_path.is_file() {
        return Ok(None);
    }
    read_project_snapshot_file(&json_path).map(Some)
}

pub fn write_project_snapshot(app_data_dir: &Path, snapshot: &ProjectSnapshot) -> Result<(), String> {
    ensure_projects_root(app_data_dir)?;
    let project_dir = resolve_project_dir(app_data_dir, &snapshot.id);
    fs::create_dir_all(&project_dir)
        .map_err(|err| format!("Failed to create project dir: {err}"))?;
    let _ = resolve_project_assets_dir(app_data_dir, &snapshot.id)?;

    let json_path = project_dir.join(PROJECT_JSON);
    let tmp_path = project_dir.join(format!("{PROJECT_JSON}.tmp"));
    let payload = serde_json::to_string_pretty(snapshot)
        .map_err(|err| format!("Failed to encode project snapshot: {err}"))?;

    {
        let mut file = fs::File::create(&tmp_path)
            .map_err(|err| format!("Failed to create temp project.json: {err}"))?;
        file.write_all(payload.as_bytes())
            .map_err(|err| format!("Failed to write temp project.json: {err}"))?;
        file.sync_all()
            .map_err(|err| format!("Failed to sync temp project.json: {err}"))?;
    }

    fs::rename(&tmp_path, &json_path)
        .map_err(|err| format!("Failed to replace project.json: {err}"))?;
    Ok(())
}

pub fn update_project_viewport(
    app_data_dir: &Path,
    project_id: &str,
    viewport: Value,
) -> Result<(), String> {
    let Some(mut snapshot) = get_project_snapshot(app_data_dir, project_id)? else {
        return Err(format!("Project not found: {project_id}"));
    };
    snapshot.viewport = viewport;
    write_project_snapshot(app_data_dir, &snapshot)
}

pub fn rename_project(
    app_data_dir: &Path,
    project_id: &str,
    name: &str,
    updated_at: i64,
) -> Result<(), String> {
    let Some(mut snapshot) = get_project_snapshot(app_data_dir, project_id)? else {
        return Err(format!("Project not found: {project_id}"));
    };
    snapshot.name = name.to_string();
    snapshot.updated_at = updated_at;
    write_project_snapshot(app_data_dir, &snapshot)
}

pub fn delete_project(app_data_dir: &Path, project_id: &str) -> Result<(), String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if project_dir.is_dir() {
        fs::remove_dir_all(&project_dir)
            .map_err(|err| format!("Failed to delete project dir: {err}"))?;
    }
    Ok(())
}

fn read_project_snapshot_file(json_path: &Path) -> Result<ProjectSnapshot, String> {
    let raw = fs::read_to_string(json_path)
        .map_err(|err| format!("Failed to read project.json: {err}"))?;
    parse_project_snapshot_json(&raw)
}

fn parse_project_snapshot_json(raw: &str) -> Result<ProjectSnapshot, String> {
    let mut value: Value = serde_json::from_str(raw)
        .map_err(|err| format!("Failed to parse project.json: {err}"))?;

    let Some(obj) = value.as_object_mut() else {
        return Err("Failed to parse project.json: root must be an object".to_string());
    };

    let created_at = obj
        .get("createdAt")
        .and_then(|item| item.as_i64())
        .ok_or_else(|| "Failed to parse project.json: missing field `createdAt`".to_string())?;

    if !obj.contains_key("updatedAt") {
        obj.insert("updatedAt".to_string(), Value::Number(created_at.into()));
    }

    if !obj.contains_key("viewport") {
        obj.insert(
            "viewport".to_string(),
            serde_json::json!({ "x": 0.0, "y": 0.0, "zoom": 1.0 }),
        );
    }

    if !obj.contains_key("nodeCount") {
        let node_count = obj
            .get("nodes")
            .and_then(|item| item.as_array())
            .map(|nodes| nodes.len() as i64)
            .unwrap_or(0);
        obj.insert("nodeCount".to_string(), Value::Number(node_count.into()));
    }

    serde_json::from_value(value).map_err(|err| format!("Failed to parse project.json: {err}"))
}

pub fn normalize_asset_relative_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim().replace('\\', "/");
    let trimmed = trimmed.trim_start_matches('/');

    if trimmed.is_empty() || trimmed == ASSETS_DIR {
        return Err("Invalid asset path".to_string());
    }

    let normalized = if trimmed.starts_with(&format!("{ASSETS_DIR}/")) {
        trimmed.to_string()
    } else {
        format!("{ASSETS_DIR}/{trimmed}")
    };

    if normalized.contains("..") {
        return Err("Invalid asset path".to_string());
    }

    for segment in normalized.split('/') {
        if segment.is_empty() || segment == "." {
            return Err("Invalid asset path".to_string());
        }
    }

    Ok(normalized)
}

fn resolve_existing_project_relative_path(
    project_dir: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if relative_path.contains("..") {
        return Err("Invalid asset path".to_string());
    }

    let candidate = project_dir.join(relative_path);
    let canonical_project = fs::canonicalize(project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;
    let canonical = fs::canonicalize(&candidate)
        .map_err(|err| format!("Asset not found: {err}"))?;
    if !canonical.starts_with(&canonical_project) {
        return Err("Asset path escapes project dir".to_string());
    }
    Ok(canonical)
}

fn ensure_parent_dir_for_asset_path(
    project_dir: &Path,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if relative_path.contains("..") {
        return Err("Invalid asset path".to_string());
    }

    let candidate = project_dir.join(relative_path);
    let canonical_project = fs::canonicalize(project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;

    if candidate.exists() {
        let canonical = fs::canonicalize(&candidate)
            .map_err(|err| format!("Asset path unavailable: {err}"))?;
        if !canonical.starts_with(&canonical_project) {
            return Err("Asset path escapes project dir".to_string());
        }
        return Ok(canonical);
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "Invalid asset path".to_string())?;
    if !parent.exists() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create asset parent dir: {err}"))?;
    }
    let canonical_parent = fs::canonicalize(parent)
        .map_err(|err| format!("Asset parent dir unavailable: {err}"))?;
    if !canonical_parent.starts_with(&canonical_project) {
        return Err("Asset path escapes project dir".to_string());
    }

    Ok(candidate)
}

pub fn list_assets_tree(
    app_data_dir: &Path,
    project_id: &str,
) -> Result<ProjectDirectoryEntry, String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let assets_dir = project_dir.join(ASSETS_DIR);
    if !assets_dir.is_dir() {
        let _ = resolve_project_assets_dir(app_data_dir, project_id)?;
        return Ok(ProjectDirectoryEntry {
            name: ASSETS_DIR.to_string(),
            path: ASSETS_DIR.to_string(),
            kind: "directory".to_string(),
            size: None,
            children: None,
        });
    }

    build_directory_entry(&project_dir, ASSETS_DIR)
}

pub fn create_asset_directory(
    app_data_dir: &Path,
    project_id: &str,
    path: &str,
) -> Result<String, String> {
    let normalized = normalize_asset_relative_path(path)?;
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let target = ensure_parent_dir_for_asset_path(&project_dir, &normalized)?;
    if target.is_file() {
        return Err("Asset path already exists as file".to_string());
    }
    fs::create_dir_all(&target)
        .map_err(|err| format!("Failed to create asset directory: {err}"))?;
    Ok(normalized)
}

pub fn write_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<String, String> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err("Invalid asset file name".to_string());
    }

    write_project_asset_at_path(app_data_dir, project_id, &format!("{ASSETS_DIR}/{file_name}"), bytes)
}

pub fn write_project_asset_at_path(
    app_data_dir: &Path,
    project_id: &str,
    relative_path: &str,
    bytes: &[u8],
) -> Result<String, String> {
    let normalized = normalize_asset_relative_path(relative_path)?;
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let target = ensure_parent_dir_for_asset_path(&project_dir, &normalized)?;
    if target.is_dir() {
        return Err("Asset path is a directory".to_string());
    }

    fs::write(&target, bytes).map_err(|err| format!("Failed to write project asset: {err}"))?;
    Ok(normalized)
}

pub fn move_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    from_path: &str,
    to_path: &str,
) -> Result<(String, String), String> {
    let from_normalized = normalize_asset_relative_path(from_path)?;
    let to_normalized = normalize_asset_relative_path(to_path)?;
    if from_normalized == to_normalized {
        return Ok((from_normalized, to_normalized));
    }

    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let from_target = resolve_existing_project_relative_path(&project_dir, &from_normalized)?;
    if !from_target.exists() {
        return Err(format!("Asset not found: {from_normalized}"));
    }

    let to_target = project_dir.join(&to_normalized);
    if to_target.exists() {
        return Err(format!("Destination already exists: {to_normalized}"));
    }

    if let Some(parent) = to_target.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create destination parent dir: {err}"))?;
    }

    let canonical_project = fs::canonicalize(&project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;
    let canonical_to_parent = fs::canonicalize(to_target.parent().unwrap_or(&project_dir))
        .map_err(|err| format!("Destination parent unavailable: {err}"))?;
    if !canonical_to_parent.starts_with(&canonical_project) {
        return Err("Asset path escapes project dir".to_string());
    }

    fs::rename(&from_target, &to_target)
        .map_err(|err| format!("Failed to move asset: {err}"))?;
    Ok((from_normalized, to_normalized))
}

fn copy_path_recursive(from: &Path, to: &Path) -> Result<(), String> {
    if from.is_file() {
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Failed to create destination parent dir: {err}"))?;
        }
        fs::copy(from, to).map_err(|err| format!("Failed to copy asset file: {err}"))?;
        return Ok(());
    }

    if from.is_dir() {
        fs::create_dir_all(to)
            .map_err(|err| format!("Failed to create destination directory: {err}"))?;
        for entry in fs::read_dir(from).map_err(|err| format!("Failed to read source directory: {err}"))? {
            let entry = entry.map_err(|err| format!("Failed to read directory entry: {err}"))?;
            let file_name = entry.file_name();
            copy_path_recursive(&entry.path(), &to.join(file_name))?;
        }
        return Ok(());
    }

    Err(format!("Unsupported asset source type: {}", from.display()))
}

pub fn copy_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    from_path: &str,
    to_path: &str,
) -> Result<(String, String), String> {
    let from_normalized = normalize_asset_relative_path(from_path)?;
    let to_normalized = normalize_asset_relative_path(to_path)?;
    if from_normalized == to_normalized {
        return Ok((from_normalized, to_normalized));
    }

    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let from_target = resolve_existing_project_relative_path(&project_dir, &from_normalized)?;
    if !from_target.exists() {
        return Err(format!("Asset not found: {from_normalized}"));
    }

    let to_target = project_dir.join(&to_normalized);
    if to_target.exists() {
        return Err(format!("Destination already exists: {to_normalized}"));
    }

    let canonical_project = fs::canonicalize(&project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;
    let canonical_from = fs::canonicalize(&from_target)
        .map_err(|err| format!("Source asset unavailable: {err}"))?;
    if !canonical_from.starts_with(&canonical_project) {
        return Err("Asset path escapes project dir".to_string());
    }

    if let Some(parent) = to_target.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create destination parent dir: {err}"))?;
        let canonical_to_parent = fs::canonicalize(parent)
            .map_err(|err| format!("Destination parent unavailable: {err}"))?;
        if !canonical_to_parent.starts_with(&canonical_project) {
            return Err("Asset path escapes project dir".to_string());
        }
    }

    copy_path_recursive(&from_target, &to_target)?;
    Ok((from_normalized, to_normalized))
}

pub fn delete_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    relative_path: &str,
) -> Result<(), String> {
    let normalized = normalize_asset_relative_path(relative_path)?;
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let target = resolve_existing_project_relative_path(&project_dir, &normalized)?;

    if target.is_dir() {
        let mut entries = fs::read_dir(&target)
            .map_err(|err| format!("Failed to read asset directory: {err}"))?;
        if entries.next().is_some() {
            return Err("Directory is not empty".to_string());
        }
        fs::remove_dir(&target).map_err(|err| format!("Failed to delete asset directory: {err}"))?;
        return Ok(());
    }

    fs::remove_file(&target).map_err(|err| format!("Failed to delete asset file: {err}"))
}

pub fn read_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    resolve_existing_project_relative_path(&project_dir, relative_path)
}

pub fn list_project_directory(
    app_data_dir: &Path,
    project_id: &str,
) -> Result<ProjectDirectoryEntry, String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let root_name = get_project_snapshot(app_data_dir, project_id)?
        .map(|snapshot| snapshot.name)
        .unwrap_or_else(|| project_id.to_string());

    let mut children = Vec::new();
    let json_path = project_dir.join(PROJECT_JSON);
    if json_path.is_file() {
        children.push(build_file_entry(&project_dir, PROJECT_JSON)?);
    }

    let assets_dir = project_dir.join(ASSETS_DIR);
    if assets_dir.is_dir() {
        children.push(build_directory_entry(&project_dir, ASSETS_DIR)?);
    }

    children.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));

    Ok(ProjectDirectoryEntry {
        name: root_name,
        path: ".".to_string(),
        kind: "directory".to_string(),
        size: None,
        children: Some(children),
    })
}

fn build_file_entry(project_dir: &Path, relative_path: &str) -> Result<ProjectDirectoryEntry, String> {
    let path = project_dir.join(relative_path);
    let metadata = fs::metadata(&path).map_err(|err| format!("Failed to read file metadata: {err}"))?;
    let name = Path::new(relative_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(relative_path)
        .to_string();

    Ok(ProjectDirectoryEntry {
        name,
        path: relative_path.replace('\\', "/"),
        kind: "file".to_string(),
        size: Some(metadata.len()),
        children: None,
    })
}

fn build_directory_entry(project_dir: &Path, relative_path: &str) -> Result<ProjectDirectoryEntry, String> {
    let path = project_dir.join(relative_path);
    let name = Path::new(relative_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(relative_path)
        .to_string();

    let mut children = Vec::new();
    let entries = fs::read_dir(&path).map_err(|err| format!("Failed to read directory: {err}"))?;
    for entry_result in entries {
        let entry = entry_result.map_err(|err| format!("Failed to read directory entry: {err}"))?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        let child_relative = format!("{relative_path}/{file_name}").replace('\\', "/");
        let file_type = entry
            .file_type()
            .map_err(|err| format!("Failed to read entry type: {err}"))?;
        if file_type.is_dir() {
            children.push(build_directory_entry(project_dir, &child_relative)?);
        } else if file_type.is_file() {
            children.push(build_file_entry(project_dir, &child_relative)?);
        }
    }

    children.sort_by(|left, right| {
        let left_is_dir = left.kind == "directory";
        let right_is_dir = right.kind == "directory";
        match (left_is_dir, right_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
        }
    });

    Ok(ProjectDirectoryEntry {
        name,
        path: relative_path.replace('\\', "/"),
        kind: "directory".to_string(),
        size: None,
        children: if children.is_empty() {
            None
        } else {
            Some(children)
        },
    })
}

pub fn resolve_project_asset_absolute_path(
    app_data_dir: &Path,
    project_id: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }
    resolve_existing_project_relative_path(&project_dir, relative_path)
}

pub fn try_project_relative_asset_path(
    app_data_dir: &Path,
    project_id: &str,
    absolute_path: &Path,
) -> Option<String> {
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return None;
    }

    let assets_dir = project_dir.join(ASSETS_DIR);
    let canonical_project = fs::canonicalize(&project_dir).ok()?;
    let canonical_assets = fs::canonicalize(&assets_dir).ok()?;
    let canonical_abs = fs::canonicalize(absolute_path).ok()?;
    if !canonical_abs.starts_with(&canonical_assets) {
        return None;
    }

    let relative = canonical_abs
        .strip_prefix(&canonical_project)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    normalize_asset_relative_path(&relative).ok()
}

#[derive(Debug, Clone)]
pub struct ImportedAssetItem {
    pub dest_relative: String,
    pub kind: String,
    pub file_paths: Vec<String>,
}

fn resolve_unique_asset_dest_path(
    project_dir: &Path,
    target_dir: &str,
    base_name: &str,
) -> Result<String, String> {
    let target_normalized = normalize_asset_relative_path(target_dir)?;
    let desired = if target_normalized == ASSETS_DIR {
        format!("{ASSETS_DIR}/{base_name}")
    } else {
        format!("{target_normalized}/{base_name}")
    };

    if !project_dir.join(&desired).exists() {
        return Ok(desired);
    }

    let dot = base_name.rfind('.');
    let (stem, ext) = if let Some(index) = dot {
        (&base_name[..index], &base_name[index..])
    } else {
        (base_name, "")
    };

    for index in 1..1000 {
        let candidate_name = format!("{stem} ({index}){ext}");
        let candidate = if target_normalized == ASSETS_DIR {
            format!("{ASSETS_DIR}/{candidate_name}")
        } else {
            format!("{target_normalized}/{candidate_name}")
        };
        if !project_dir.join(&candidate).exists() {
            return Ok(candidate);
        }
    }

    Err(format!("无法生成唯一路径: {desired}"))
}

fn collect_asset_file_paths(project_dir: &Path, relative_path: &str) -> Result<Vec<String>, String> {
    let normalized = normalize_asset_relative_path(relative_path)?;
    let target = project_dir.join(&normalized);
    if target.is_file() {
        return Ok(vec![normalized]);
    }
    if !target.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    collect_asset_files_recursive(project_dir, &target, &mut files)?;
    Ok(files)
}

fn collect_asset_files_recursive(
    project_dir: &Path,
    dir: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|err| format!("Failed to read asset directory: {err}"))? {
        let entry = entry.map_err(|err| format!("Failed to read directory entry: {err}"))?;
        let path = entry.path();
        if path.is_dir() {
            collect_asset_files_recursive(project_dir, &path, files)?;
            continue;
        }
        if !path.is_file() {
            continue;
        }
        let relative = path
            .strip_prefix(project_dir)
            .map_err(|_| "Asset path escapes project dir".to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        files.push(normalize_asset_relative_path(&relative)?);
    }
    Ok(())
}

pub fn import_external_paths_into_assets(
    app_data_dir: &Path,
    project_id: &str,
    source_paths: &[PathBuf],
    target_dir_path: &str,
) -> Result<Vec<ImportedAssetItem>, String> {
    let target_dir = normalize_asset_relative_path(target_dir_path)?;
    let project_dir = resolve_project_dir(app_data_dir, project_id);
    if !project_dir.is_dir() {
        return Err(format!("Project not found: {project_id}"));
    }

    let canonical_project = fs::canonicalize(&project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;

    let mut results = Vec::new();
    for source_path in source_paths {
        if !source_path.exists() {
            continue;
        }

        let source = fs::canonicalize(source_path)
            .map_err(|err| format!("Source path unavailable: {err}"))?;
        let base_name = source
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", source.display()))?
            .to_string_lossy()
            .to_string();
        let dest_relative = resolve_unique_asset_dest_path(&project_dir, &target_dir, &base_name)?;
        let dest_absolute = project_dir.join(&dest_relative);

        if let Some(parent) = dest_absolute.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Failed to create destination parent dir: {err}"))?;
            let canonical_parent = fs::canonicalize(parent)
                .map_err(|err| format!("Destination parent unavailable: {err}"))?;
            if !canonical_parent.starts_with(&canonical_project) {
                return Err("Asset path escapes project dir".to_string());
            }
        }

        copy_path_recursive(&source, &dest_absolute)?;

        let kind = if source.is_dir() {
            "directory".to_string()
        } else {
            "file".to_string()
        };
        let file_paths = collect_asset_file_paths(&project_dir, &dest_relative)?;

        results.push(ImportedAssetItem {
            dest_relative,
            kind,
            file_paths,
        });
    }

    Ok(results)
}
