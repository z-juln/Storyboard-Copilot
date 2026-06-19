use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::media::dto::{
    CompleteImageUploadRequestDto, CreateImageUploadSessionResponseDto,
    PrepareNodeImageResponseDto,
};
use crate::media::store::{normalize_extension, prepare_from_bytes};

pub const UPLOAD_CHUNK_SIZE: usize = 4 * 1024 * 1024;
const MAX_UPLOAD_BYTES: u64 = 256 * 1024 * 1024;

fn uploads_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("uploads")
}

fn session_dir(app_data_dir: &Path, upload_id: &str) -> Result<PathBuf, String> {
    validate_upload_id(upload_id)?;
    Ok(uploads_root(app_data_dir).join(upload_id))
}

fn validate_upload_id(upload_id: &str) -> Result<(), String> {
    Uuid::parse_str(upload_id.trim())
        .map(|_| ())
        .map_err(|_| "Invalid upload session id".to_string())
}

pub fn create_upload_session(app_data_dir: &Path) -> Result<CreateImageUploadSessionResponseDto, String> {
    let upload_id = Uuid::new_v4().to_string();
    let dir = session_dir(app_data_dir, &upload_id)?;
    fs::create_dir_all(&dir).map_err(|err| format!("Failed to create upload session dir: {err}"))?;

    Ok(CreateImageUploadSessionResponseDto {
        upload_id,
        chunk_size: UPLOAD_CHUNK_SIZE as u64,
    })
}

pub fn write_upload_chunk(
    app_data_dir: &Path,
    upload_id: &str,
    chunk_index: u32,
    bytes: &[u8],
) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("Upload chunk is empty".to_string());
    }
    if bytes.len() > UPLOAD_CHUNK_SIZE {
        return Err(format!(
            "Upload chunk exceeds limit: {} > {}",
            bytes.len(),
            UPLOAD_CHUNK_SIZE
        ));
    }

    let dir = session_dir(app_data_dir, upload_id)?;
    if !dir.is_dir() {
        return Err("Upload session not found".to_string());
    }

    let chunk_path = dir.join(format!("{chunk_index}.part"));
    fs::write(&chunk_path, bytes).map_err(|err| format!("Failed to write upload chunk: {err}"))?;
    Ok(())
}

pub fn complete_upload_session(
    app_data_dir: &Path,
    upload_id: &str,
    request: CompleteImageUploadRequestDto,
) -> Result<PrepareNodeImageResponseDto, String> {
    if request.total_chunks == 0 {
        return Err("totalChunks must be greater than 0".to_string());
    }

    let dir = session_dir(app_data_dir, upload_id)?;
    if !dir.is_dir() {
        return Err("Upload session not found".to_string());
    }

    let mut assembled = Vec::new();
    for chunk_index in 0..request.total_chunks {
        let chunk_path = dir.join(format!("{chunk_index}.part"));
        if !chunk_path.is_file() {
            return Err(format!("Missing upload chunk: {chunk_index}"));
        }

        let mut chunk_file =
            File::open(&chunk_path).map_err(|err| format!("Failed to open upload chunk: {err}"))?;
        let mut chunk_bytes = Vec::new();
        chunk_file
            .read_to_end(&mut chunk_bytes)
            .map_err(|err| format!("Failed to read upload chunk: {err}"))?;
        if chunk_bytes.is_empty() {
            return Err(format!("Upload chunk is empty: {chunk_index}"));
        }
        if chunk_bytes.len() > UPLOAD_CHUNK_SIZE {
            return Err(format!("Upload chunk exceeds limit: {chunk_index}"));
        }

        let next_size = assembled
            .len()
            .saturating_add(chunk_bytes.len()) as u64;
        if next_size > MAX_UPLOAD_BYTES {
            return Err(format!(
                "Uploaded image exceeds limit: {next_size} > {MAX_UPLOAD_BYTES}"
            ));
        }

        assembled.extend_from_slice(&chunk_bytes);
    }

    let max_preview = request.max_preview_dimension.unwrap_or(512);
    let prepared = prepare_from_bytes(
        app_data_dir,
        &assembled,
        &normalize_extension(&request.extension),
        max_preview,
    )?;

    let _ = remove_upload_session(app_data_dir, upload_id);
    Ok(prepared)
}

pub fn remove_upload_session(app_data_dir: &Path, upload_id: &str) -> Result<(), String> {
    let dir = session_dir(app_data_dir, upload_id)?;
    if dir.is_dir() {
        fs::remove_dir_all(&dir).map_err(|err| format!("Failed to remove upload session: {err}"))?;
    }
    Ok(())
}

pub fn cleanup_stale_upload_sessions(app_data_dir: &Path) -> Result<(), String> {
    let root = uploads_root(app_data_dir);
    if !root.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(&root).map_err(|err| format!("Failed to read uploads dir: {err}"))? {
        let entry = entry.map_err(|err| format!("Failed to read upload entry: {err}"))?;
        if !entry.file_type().map_err(|err| format!("Failed to read file type: {err}"))?.is_dir() {
            continue;
        }
        let _ = fs::remove_dir_all(entry.path());
    }

    Ok(())
}
