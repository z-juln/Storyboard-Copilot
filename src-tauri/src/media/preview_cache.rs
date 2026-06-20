use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use image::{DynamicImage, ImageReader};

use crate::project::file_store;

pub const DEFAULT_PREVIEW_MAX_DIMENSION: u32 = 512;
const FAST_PREVIEW_BYPASS_MAX_BYTES: usize = 2_000_000;
const FAST_PREVIEW_BYPASS_MAX_DIMENSION: u32 = 2048;

pub fn content_hash_hex(bytes: &[u8]) -> String {
    format!("{:x}", md5::compute(bytes))
}

pub fn resolve_preview_cache_dir(app_data_dir: &Path, project_id: &str) -> Result<PathBuf, String> {
    let dir = file_store::resolve_project_dir(app_data_dir, project_id).join(".cache/previews");
    fs::create_dir_all(&dir)
        .map_err(|err| format!("Failed to create preview cache dir: {err}"))?;
    Ok(dir)
}

pub fn preview_cache_file_name(content_hash: &str, max_dimension: u32) -> String {
    format!("{content_hash}_{max_dimension}.png")
}

pub fn should_bypass_preview(
    width: u32,
    height: u32,
    byte_len: usize,
    max_dimension: u32,
) -> bool {
    let longest_side = width.max(height);
    longest_side <= max_dimension
        || (byte_len <= FAST_PREVIEW_BYPASS_MAX_BYTES
            && longest_side <= FAST_PREVIEW_BYPASS_MAX_DIMENSION)
}

pub fn write_preview_cache_file(
    app_data_dir: &Path,
    project_id: &str,
    content_hash: &str,
    max_dimension: u32,
    preview_bytes: &[u8],
) -> Result<PathBuf, String> {
    let cache_dir = resolve_preview_cache_dir(app_data_dir, project_id)?;
    let file_name = preview_cache_file_name(content_hash, max_dimension);
    let output_path = cache_dir.join(&file_name);
    if !output_path.is_file() {
        fs::write(&output_path, preview_bytes)
            .map_err(|err| format!("Failed to write preview cache file: {err}"))?;
    }
    Ok(output_path)
}

pub fn resolve_preview_cache_path(
    app_data_dir: &Path,
    project_id: &str,
    content_hash: &str,
    max_dimension: u32,
) -> PathBuf {
    resolve_preview_cache_dir(app_data_dir, project_id)
        .map(|dir| dir.join(preview_cache_file_name(content_hash, max_dimension)))
        .unwrap_or_else(|_| {
            file_store::resolve_project_dir(app_data_dir, project_id)
                .join(".cache/previews")
                .join(preview_cache_file_name(content_hash, max_dimension))
        })
}

pub fn encode_preview_png(image: &DynamicImage) -> Result<Vec<u8>, String> {
    let mut preview_buffer = Cursor::new(Vec::new());
    image
        .write_to(&mut preview_buffer, image::ImageFormat::Png)
        .map_err(|err| format!("Failed to encode preview image: {err}"))?;
    Ok(preview_buffer.into_inner())
}

pub fn probe_image_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    let (raw_width, raw_height) = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|err| format!("Failed to guess image format: {err}"))?
        .into_dimensions()
        .map_err(|err| format!("Failed to parse image dimensions: {err}"))?;
    Ok((raw_width.max(1), raw_height.max(1)))
}

pub fn build_preview_png_bytes(
    bytes: &[u8],
    width: u32,
    height: u32,
    max_dimension: u32,
) -> Result<Vec<u8>, String> {
    use crate::media::store::resize_image_fast;

    let image = image::load_from_memory(bytes)
        .map_err(|err| format!("Failed to decode image source: {err}"))?;
    let longest_side = width.max(height).max(1);
    let scale = max_dimension as f64 / longest_side as f64;
    let target_width = ((width as f64) * scale).round().max(1.0) as u32;
    let target_height = ((height as f64) * scale).round().max(1.0) as u32;
    let resized_rgba = resize_image_fast(&image, target_width, target_height).unwrap_or_else(|_| {
        image
            .resize(target_width, target_height, image::imageops::FilterType::Triangle)
            .to_rgba8()
    });
    let resized = DynamicImage::ImageRgba8(resized_rgba);
    encode_preview_png(&resized)
}

pub fn ensure_preview_cache_for_bytes(
    app_data_dir: &Path,
    project_id: &str,
    bytes: &[u8],
    max_dimension: u32,
) -> Result<(String, PathBuf, bool), String> {
    let safe_max_dimension = max_dimension.clamp(64, 4096);
    let (width, height) = probe_image_dimensions(bytes)?;
    let content_hash = content_hash_hex(bytes);

    if should_bypass_preview(width, height, bytes.len(), safe_max_dimension) {
        return Ok((content_hash, PathBuf::new(), true));
    }

    let cache_path = resolve_preview_cache_path(app_data_dir, project_id, &content_hash, safe_max_dimension);
    if cache_path.is_file() {
        return Ok((content_hash, cache_path, false));
    }

    let preview_bytes = build_preview_png_bytes(bytes, width, height, safe_max_dimension)?;
    let written =
        write_preview_cache_file(app_data_dir, project_id, &content_hash, safe_max_dimension, &preview_bytes)?;
    Ok((content_hash, written, false))
}

pub fn resolve_asset_preview_file(
    app_data_dir: &Path,
    project_id: &str,
    asset_relative_path: &str,
    max_dimension: u32,
) -> Result<PathBuf, String> {
    let asset_path =
        file_store::read_project_asset(app_data_dir, project_id, asset_relative_path)?;
    let bytes = fs::read(&asset_path)
        .map_err(|err| format!("Failed to read project asset: {err}"))?;
    let safe_max_dimension = max_dimension.clamp(64, 4096);
    let (_, cache_path, bypass) =
        ensure_preview_cache_for_bytes(app_data_dir, project_id, &bytes, safe_max_dimension)?;
    if bypass {
        return Ok(asset_path);
    }
    Ok(cache_path)
}
