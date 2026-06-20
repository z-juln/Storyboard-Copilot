use std::path::{Path, PathBuf};

use super::dto::{
    ImportedAssetItemDto, ImportProjectAssetsResponseDto, ProjectDirectoryEntry, ProjectSnapshot,
    ProjectSummaryRecord,
};
use super::file_store::{self, ImportedAssetItem};

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

    pub fn list_directory(&self, project_id: &str) -> Result<ProjectDirectoryEntry, String> {
        file_store::list_project_directory(&self.app_data_dir, project_id)
    }

    pub fn list_assets_tree(&self, project_id: &str) -> Result<ProjectDirectoryEntry, String> {
        file_store::list_assets_tree(&self.app_data_dir, project_id)
    }

    pub fn create_asset_directory(&self, project_id: &str, path: &str) -> Result<String, String> {
        file_store::create_asset_directory(&self.app_data_dir, project_id, path)
    }

    pub fn write_asset_at_path(
        &self,
        project_id: &str,
        relative_path: &str,
        bytes: &[u8],
    ) -> Result<String, String> {
        file_store::write_project_asset_at_path(&self.app_data_dir, project_id, relative_path, bytes)
    }

    pub fn move_asset(
        &self,
        project_id: &str,
        from_path: &str,
        to_path: &str,
    ) -> Result<(String, String), String> {
        file_store::move_project_asset(&self.app_data_dir, project_id, from_path, to_path)
    }

    pub fn copy_asset(
        &self,
        project_id: &str,
        from_path: &str,
        to_path: &str,
    ) -> Result<(String, String), String> {
        file_store::copy_project_asset(&self.app_data_dir, project_id, from_path, to_path)
    }

    pub fn delete_asset(&self, project_id: &str, path: &str) -> Result<(), String> {
        file_store::delete_project_asset(&self.app_data_dir, project_id, path)
    }

    pub fn import_assets(
        &self,
        project_id: &str,
        target_dir: &str,
        sources: &[String],
    ) -> Result<ImportProjectAssetsResponseDto, String> {
        let source_paths = sources.iter().map(PathBuf::from).collect::<Vec<_>>();
        let imports = file_store::import_external_paths_into_assets(
            &self.app_data_dir,
            project_id,
            &source_paths,
            target_dir,
        )?;
        Ok(ImportProjectAssetsResponseDto {
            imports: imports.into_iter().map(map_imported_asset_item).collect(),
        })
    }
}

fn map_imported_asset_item(item: ImportedAssetItem) -> ImportedAssetItemDto {
    ImportedAssetItemDto {
        dest_relative: item.dest_relative,
        kind: item.kind,
        file_paths: item.file_paths,
    }
}
