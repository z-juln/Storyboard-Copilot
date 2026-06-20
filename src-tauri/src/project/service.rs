use std::path::{Path, PathBuf};

use super::dto::{ProjectSnapshot, ProjectSummaryRecord};
use super::file_store;

pub struct ProjectService {
    app_data_dir: PathBuf,
}

impl ProjectService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn app_data_dir(&self) -> &Path {
        &self.app_data_dir
    }

    pub fn list_summaries(&self) -> Result<Vec<ProjectSummaryRecord>, String> {
        file_store::list_project_summaries(&self.app_data_dir)
    }

    pub fn get_snapshot(&self, project_id: &str) -> Result<Option<ProjectSnapshot>, String> {
        file_store::get_project_snapshot(&self.app_data_dir, project_id)
    }

    pub fn upsert_snapshot(&self, snapshot: ProjectSnapshot) -> Result<(), String> {
        file_store::write_project_snapshot(&self.app_data_dir, &snapshot)
    }

    pub fn update_viewport(
        &self,
        project_id: &str,
        viewport: serde_json::Value,
    ) -> Result<(), String> {
        file_store::update_project_viewport(&self.app_data_dir, project_id, viewport)
    }

    pub fn rename(&self, project_id: &str, name: &str, updated_at: i64) -> Result<(), String> {
        file_store::rename_project(&self.app_data_dir, project_id, name, updated_at)
    }

    pub fn delete(&self, project_id: &str) -> Result<(), String> {
        file_store::delete_project(&self.app_data_dir, project_id)
    }
}
