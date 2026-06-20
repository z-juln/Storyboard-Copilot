use tauri::{AppHandle, Manager};

pub use crate::project::{
    ProjectSnapshot, ProjectSummaryRecord, RenameProjectRequestDto, UpdateProjectViewportRequestDto,
};

fn resolve_app_data_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    crate::project::file_store::ensure_projects_root(&app_data_dir)?;
    Ok(app_data_dir)
}

#[tauri::command]
pub fn list_project_summaries(app: AppHandle) -> Result<Vec<ProjectSummaryRecord>, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::list_project_summaries(&app_data_dir)
}

#[tauri::command]
pub fn get_project_snapshot(
    app: AppHandle,
    project_id: String,
) -> Result<Option<ProjectSnapshot>, String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::get_project_snapshot(&app_data_dir, &project_id)
}

#[tauri::command]
pub fn upsert_project_snapshot(app: AppHandle, snapshot: ProjectSnapshot) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::write_project_snapshot(&app_data_dir, &snapshot)
}

#[tauri::command]
pub fn update_project_viewport_record(
    app: AppHandle,
    project_id: String,
    viewport: serde_json::Value,
) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::update_project_viewport(&app_data_dir, &project_id, viewport)
}

#[tauri::command]
pub fn rename_project_record(
    app: AppHandle,
    project_id: String,
    name: String,
    updated_at: i64,
) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::rename_project(&app_data_dir, &project_id, &name, updated_at)
}

#[tauri::command]
pub fn delete_project_record(app: AppHandle, project_id: String) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    crate::project::file_store::delete_project(&app_data_dir, &project_id)
}
