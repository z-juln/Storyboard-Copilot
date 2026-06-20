use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::dto::{ProjectSnapshot, ProjectSummaryRecord};

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

        let snapshot = read_project_snapshot_file(&json_path)?;
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
    serde_json::from_str(&raw).map_err(|err| format!("Failed to parse project.json: {err}"))
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

    let assets_dir = resolve_project_assets_dir(app_data_dir, project_id)?;
    let target = assets_dir.join(file_name);
    fs::write(&target, bytes).map_err(|err| format!("Failed to write project asset: {err}"))?;
    Ok(format!("{ASSETS_DIR}/{file_name}"))
}

pub fn read_project_asset(
    app_data_dir: &Path,
    project_id: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    if relative_path.contains("..") {
        return Err("Invalid asset path".to_string());
    }

    let project_dir = resolve_project_dir(app_data_dir, project_id);
    let candidate = project_dir.join(relative_path);
    let canonical_project = fs::canonicalize(&project_dir)
        .map_err(|err| format!("Project dir unavailable: {err}"))?;
    let canonical_file = fs::canonicalize(&candidate)
        .map_err(|err| format!("Asset not found: {err}"))?;

    if !canonical_file.starts_with(&canonical_project) {
        return Err("Asset path escapes project dir".to_string());
    }

    Ok(canonical_file)
}
