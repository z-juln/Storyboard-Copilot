use std::fs;
use std::path::Path;

pub fn write_file_paths_as_text(paths: &[String]) -> Result<(), String> {
    let payload = paths.join("\n");
    arboard::Clipboard::new()
        .map_err(|err| format!("Failed to access clipboard: {err}"))?
        .set_text(payload)
        .map_err(|err| format!("Failed to write clipboard text: {err}"))
}

pub fn read_file_paths_from_text() -> Result<Vec<String>, String> {
    let text = arboard::Clipboard::new()
        .map_err(|err| format!("Failed to access clipboard: {err}"))?
        .get_text()
        .map_err(|err| format!("Failed to read clipboard text: {err}"))?;

    let paths = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| Path::new(line).exists())
        .map(str::to_string)
        .collect::<Vec<_>>();

    Ok(paths)
}

pub fn is_directory(path: &str) -> bool {
    fs::metadata(path).map(|meta| meta.is_dir()).unwrap_or(false)
}
