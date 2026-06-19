use std::path::{Path, PathBuf};

use super::dto::{ProjectRecord, ProjectSummaryRecord};
use super::store;

pub struct ProjectService {
    db_path: PathBuf,
    app_data_dir: PathBuf,
}

impl ProjectService {
    pub fn new(db_path: PathBuf) -> Self {
        let app_data_dir = db_path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| db_path.clone());
        Self {
            db_path,
            app_data_dir,
        }
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn list_summaries(&self) -> Result<Vec<ProjectSummaryRecord>, String> {
        store::list_project_summaries(&self.db_path)
    }

    pub fn get_record(&self, project_id: &str) -> Result<Option<ProjectRecord>, String> {
        store::get_project_record(&self.db_path, project_id)
    }

    pub fn upsert_record(&self, record: ProjectRecord) -> Result<(), String> {
        store::upsert_project_record(&self.db_path, &self.app_data_dir, record)
    }

    pub fn update_viewport(&self, project_id: &str, viewport_json: &str) -> Result<(), String> {
        store::update_project_viewport_record(&self.db_path, project_id, viewport_json)
    }

    pub fn rename(&self, project_id: &str, name: &str, updated_at: i64) -> Result<(), String> {
        store::rename_project_record(&self.db_path, project_id, name, updated_at)
    }

    pub fn delete(&self, project_id: &str) -> Result<(), String> {
        store::delete_project_record(&self.db_path, &self.app_data_dir, project_id)
    }
}
