use std::path::PathBuf;

use tauri::{AppHandle, Manager};

pub use crate::project::{
    ProjectRecord, ProjectSummaryRecord, RenameProjectRequestDto, UpdateProjectViewportRequestDto,
};

fn resolve_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    crate::project::store::ensure_app_data_dir(&app_data_dir)?;
    Ok((app_data_dir.join("projects.db"), app_data_dir))
}

#[tauri::command]
pub fn list_project_summaries(app: AppHandle) -> Result<Vec<ProjectSummaryRecord>, String> {
    let (db_path, _) = resolve_paths(&app)?;
    crate::project::store::list_project_summaries(&db_path)
}

#[tauri::command]
pub fn get_project_record(
    app: AppHandle,
    project_id: String,
) -> Result<Option<ProjectRecord>, String> {
    let (db_path, _) = resolve_paths(&app)?;
    crate::project::store::get_project_record(&db_path, &project_id)
}

#[tauri::command]
pub fn upsert_project_record(app: AppHandle, record: ProjectRecord) -> Result<(), String> {
    let (db_path, app_data_dir) = resolve_paths(&app)?;
    crate::project::store::upsert_project_record(&db_path, &app_data_dir, record)
}

#[tauri::command]
pub fn update_project_viewport_record(
    app: AppHandle,
    project_id: String,
    viewport_json: String,
) -> Result<(), String> {
    let (db_path, _) = resolve_paths(&app)?;
    crate::project::store::update_project_viewport_record(&db_path, &project_id, &viewport_json)
}

#[tauri::command]
pub fn rename_project_record(
    app: AppHandle,
    project_id: String,
    name: String,
    updated_at: i64,
) -> Result<(), String> {
    let (db_path, _) = resolve_paths(&app)?;
    crate::project::store::rename_project_record(&db_path, &project_id, &name, updated_at)
}

#[tauri::command]
pub fn delete_project_record(app: AppHandle, project_id: String) -> Result<(), String> {
    let (db_path, app_data_dir) = resolve_paths(&app)?;
    crate::project::store::delete_project_record(&db_path, &app_data_dir, &project_id)
}
