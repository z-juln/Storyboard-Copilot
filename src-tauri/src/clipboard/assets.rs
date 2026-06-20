use std::path::{Path, PathBuf};

use crate::project::file_store;

use super::{ClipboardPasteItemDto, ClipboardPastePayloadDto};

pub fn write_project_assets_to_clipboard(
    app_data_dir: &Path,
    project_id: &str,
    relative_paths: &[String],
    cut: bool,
) -> Result<(), String> {
    let absolute_paths = resolve_project_asset_absolute_paths(app_data_dir, project_id, relative_paths)?;
    super::write_file_paths(&absolute_paths, cut)
}

pub fn read_project_assets_from_clipboard(
    app_data_dir: &Path,
    project_id: &str,
) -> Result<ClipboardPastePayloadDto, String> {
    let (paths, cut) = super::read_file_paths()?;
    let mode = if cut { "cut" } else { "copy" };

    let mut items = Vec::with_capacity(paths.len());
    for absolute_path in paths {
        let path = Path::new(&absolute_path);
        if !path.exists() {
            continue;
        }

        let kind = if path.is_dir() { "directory" } else { "file" };
        let project_relative_path =
            file_store::try_project_relative_asset_path(app_data_dir, project_id, path);

        items.push(ClipboardPasteItemDto {
            absolute_path,
            project_relative_path,
            kind: kind.to_string(),
        });
    }

    Ok(ClipboardPastePayloadDto {
        mode: mode.to_string(),
        items,
    })
}

pub fn clear_project_assets_clipboard_cut_marker() -> Result<(), String> {
    super::clear_cut_marker()
}

fn resolve_project_asset_absolute_paths(
    app_data_dir: &Path,
    project_id: &str,
    relative_paths: &[String],
) -> Result<Vec<String>, String> {
    let mut absolute_paths = Vec::with_capacity(relative_paths.len());

    for relative_path in relative_paths {
        let absolute = file_store::resolve_project_asset_absolute_path(
            app_data_dir,
            project_id,
            relative_path,
        )?;
        absolute_paths.push(path_to_clipboard_string(&absolute));
    }

    Ok(absolute_paths)
}

fn path_to_clipboard_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
