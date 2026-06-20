#[cfg(target_os = "macos")]
mod macos;

mod assets;
mod dto;
mod fallback;

pub use assets::{
    clear_project_assets_clipboard_cut_marker, read_project_assets_from_clipboard,
    write_project_assets_to_clipboard,
};
pub use dto::{
    ClipboardPasteItemDto, ClipboardPastePayloadDto, WriteProjectAssetsClipboardRequestDto,
};

const CUT_MARKER_TYPE: &str = "net.storyboard-copilot.asset-cut";

pub fn write_file_paths(paths: &[String], cut: bool) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        return macos::write_file_paths(paths, cut);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = cut;
        fallback::write_file_paths_as_text(paths)
    }
}

pub fn read_file_paths() -> Result<(Vec<String>, bool), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::read_file_paths();
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok((fallback::read_file_paths_from_text()?, false))
    }
}

pub fn clear_cut_marker() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        return macos::clear_cut_marker();
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

pub fn cut_marker_type() -> &'static str {
    CUT_MARKER_TYPE
}
