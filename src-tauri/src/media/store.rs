use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::Instant;

use base64::{engine::general_purpose::STANDARD, Engine};
use fast_image_resize as fir;
use fast_image_resize::images::Image as FirImage;
use image::{DynamicImage, ImageReader, RgbaImage};
use tracing::info;

use crate::media::dto::PrepareNodeImageResponseDto;

const FAST_PREVIEW_BYPASS_MAX_BYTES: usize = 2_000_000;
const FAST_PREVIEW_BYPASS_MAX_DIMENSION: u32 = 2048;

fn resolve_images_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let images_dir = app_data_dir.join("images");
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Failed to create images dir: {}", e))?;
    Ok(images_dir)
}

pub fn normalize_extension(raw_ext: &str) -> String {
    let ext = raw_ext.trim().trim_start_matches('.').to_ascii_lowercase();
    if ext.is_empty() {
        return "png".to_string();
    }

    if ext == "jpeg" {
        return "jpg".to_string();
    }

    ext
}

fn extension_from_mime(mime: &str) -> String {
    let normalized = mime.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "image/png" => "png".to_string(),
        "image/jpeg" => "jpg".to_string(),
        "image/jpg" => "jpg".to_string(),
        "image/webp" => "webp".to_string(),
        "image/gif" => "gif".to_string(),
        "image/bmp" => "bmp".to_string(),
        "image/avif" => "avif".to_string(),
        _ => "png".to_string(),
    }
}

fn extension_from_path_like(value: &str) -> Option<String> {
    let cleaned = value
        .split('#')
        .next()
        .unwrap_or(value)
        .split('?')
        .next()
        .unwrap_or(value);
    let ext = Path::new(cleaned)
        .extension()
        .and_then(|item| item.to_str())
        .map(normalize_extension)?;

    Some(ext)
}

fn decode_file_url_path(value: &str) -> String {
    let raw = value.trim_start_matches("file://");
    let decoded = urlencoding::decode(raw)
        .map(|result| result.into_owned())
        .unwrap_or_else(|_| raw.to_string());

    if cfg!(target_os = "windows")
        && decoded.starts_with('/')
        && decoded.len() > 2
        && decoded.as_bytes().get(2) == Some(&b':')
    {
        decoded[1..].to_string()
    } else {
        decoded
    }
}

fn parse_data_url(source: &str) -> Result<(Vec<u8>, String), String> {
    let (meta, payload) = source
        .split_once(',')
        .ok_or_else(|| "Invalid data URL format".to_string())?;

    if !meta.starts_with("data:") || !meta.ends_with(";base64") {
        return Err("Only base64 data URL is supported".to_string());
    }

    let mime = meta
        .strip_prefix("data:")
        .and_then(|v| v.strip_suffix(";base64"))
        .unwrap_or("image/png");

    let bytes = STANDARD
        .decode(payload)
        .map_err(|e| format!("Failed to decode data URL: {}", e))?;

    Ok((bytes, extension_from_mime(mime)))
}

fn gcd_u32(a: u32, b: u32) -> u32 {
    let mut x = a.max(1);
    let mut y = b.max(1);

    while y != 0 {
        let temp = y;
        y = x % y;
        x = temp;
    }

    x.max(1)
}

fn reduce_aspect_ratio(width: u32, height: u32) -> String {
    let safe_width = width.max(1);
    let safe_height = height.max(1);
    let gcd = gcd_u32(safe_width, safe_height);
    format!("{}:{}", safe_width / gcd, safe_height / gcd)
}

fn resize_image_fast(source: &DynamicImage, target_width: u32, target_height: u32) -> Result<RgbaImage, String> {
    let source_rgba = source.to_rgba8();
    let source_width = source_rgba.width().max(1);
    let source_height = source_rgba.height().max(1);
    let source_pixels = source_rgba.into_raw();

    let source_image = FirImage::from_vec_u8(
        source_width,
        source_height,
        source_pixels,
        fir::PixelType::U8x4,
    )
    .map_err(|e| format!("Failed to create source image for fast resize: {}", e))?;
    let mut target_image =
        FirImage::new(target_width.max(1), target_height.max(1), fir::PixelType::U8x4);

    let mut resizer = fir::Resizer::new();
    let resize_options =
        fir::ResizeOptions::new().resize_alg(fir::ResizeAlg::Convolution(fir::FilterType::Bilinear));
    resizer
        .resize(&source_image, &mut target_image, Some(&resize_options))
        .map_err(|e| format!("Failed to run fast image resize: {}", e))?;

    RgbaImage::from_raw(target_width.max(1), target_height.max(1), target_image.into_vec())
        .ok_or_else(|| "Failed to build RGBA image from resized buffer".to_string())
}

pub fn persist_image_bytes(
    app_data_dir: &Path,
    bytes: &[u8],
    extension: &str,
) -> Result<String, String> {
    let images_dir = resolve_images_dir(app_data_dir)?;
    let digest = md5::compute(bytes);
    let filename = format!("{:x}.{}", digest, normalize_extension(extension));
    let output_path = images_dir.join(filename);

    if !output_path.exists() {
        std::fs::write(&output_path, bytes)
            .map_err(|e| format!("Failed to persist generated image: {}", e))?;
    }

    Ok(output_path.to_string_lossy().to_string())
}

pub async fn resolve_source_bytes(source: &str) -> Result<(Vec<u8>, String), String> {
    if source.starts_with("data:") {
        return parse_data_url(source);
    }

    if source.starts_with("http://") || source.starts_with("https://") {
        let response = reqwest::get(source)
            .await
            .map_err(|e| format!("Failed to download remote image: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Remote image request failed with status {}",
                response.status()
            ));
        }

        let mime_ext = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .map(extension_from_mime);

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read remote image body: {}", e))?
            .to_vec();

        let ext = mime_ext
            .or_else(|| extension_from_path_like(source))
            .unwrap_or_else(|| "png".to_string());

        return Ok((bytes, ext));
    }

    if source.starts_with("file://") {
        let file_path = decode_file_url_path(source);
        let local_path = PathBuf::from(file_path);
        let bytes = std::fs::read(&local_path)
            .map_err(|e| format!("Failed to read file:// image source: {}", e))?;
        let ext = local_path
            .extension()
            .and_then(|item| item.to_str())
            .map(normalize_extension)
            .unwrap_or_else(|| "png".to_string());
        return Ok((bytes, ext));
    }

    let local_path = PathBuf::from(source);
    let bytes = std::fs::read(&local_path)
        .map_err(|e| format!("Failed to read local image source: {}", e))?;
    let ext = local_path
        .extension()
        .and_then(|item| item.to_str())
        .map(normalize_extension)
        .unwrap_or_else(|| "png".to_string());

    Ok((bytes, ext))
}

fn prepare_node_image_from_bytes(
    app_data_dir: &Path,
    bytes: &[u8],
    extension: &str,
    safe_max_dimension: u32,
    trace_tag: &str,
) -> Result<PrepareNodeImageResponseDto, String> {
    let started = Instant::now();
    let probe_started = Instant::now();
    let (raw_width, raw_height) = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| format!("Failed to guess image format: {}", e))?
        .into_dimensions()
        .map_err(|e| format!("Failed to parse image dimensions: {}", e))?;
    let probe_elapsed = probe_started.elapsed().as_millis();
    let width = raw_width.max(1);
    let height = raw_height.max(1);

    let persist_started = Instant::now();
    let image_path = persist_image_bytes(app_data_dir, bytes, extension)?;
    let persist_elapsed = persist_started.elapsed().as_millis();
    let longest_side = width.max(height);
    let bypass_preview = longest_side <= safe_max_dimension
        || (bytes.len() <= FAST_PREVIEW_BYPASS_MAX_BYTES
            && longest_side <= FAST_PREVIEW_BYPASS_MAX_DIMENSION);
    if bypass_preview {
        info!(
            "prepare_node_image done [{}]: bytes={}, ext={}, size={}x{}, max_preview={}, probe={}ms, decode=0ms, persist_original={}ms, resize=0ms, bypass_preview=true, total={}ms",
            trace_tag,
            bytes.len(),
            extension,
            width,
            height,
            safe_max_dimension,
            probe_elapsed,
            persist_elapsed,
            started.elapsed().as_millis()
        );
        return Ok(PrepareNodeImageResponseDto {
            image_path: image_path.clone(),
            preview_image_path: image_path,
            aspect_ratio: reduce_aspect_ratio(width, height),
        });
    }

    let decode_started = Instant::now();
    let image = image::load_from_memory(bytes)
        .map_err(|e| format!("Failed to decode image source: {}", e))?;
    let decode_elapsed = decode_started.elapsed().as_millis();

    let resize_started = Instant::now();
    let scale = safe_max_dimension as f64 / longest_side as f64;
    let target_width = ((width as f64) * scale).round().max(1.0) as u32;
    let target_height = ((height as f64) * scale).round().max(1.0) as u32;
    let resized_rgba = resize_image_fast(&image, target_width, target_height)
        .unwrap_or_else(|_| {
            image
                .resize(target_width, target_height, image::imageops::FilterType::Triangle)
                .to_rgba8()
        });
    let resized = DynamicImage::ImageRgba8(resized_rgba);

    let mut preview_buffer = Cursor::new(Vec::new());
    resized
        .write_to(&mut preview_buffer, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to encode preview image: {}", e))?;
    let preview_image_path = persist_image_bytes(app_data_dir, preview_buffer.get_ref(), "png")?;
    let resize_elapsed = resize_started.elapsed().as_millis();

    info!(
        "prepare_node_image done [{}]: bytes={}, ext={}, size={}x{}, max_preview={}, probe={}ms, decode={}ms, persist_original={}ms, resize={}ms, total={}ms",
        trace_tag,
        bytes.len(),
        extension,
        width,
        height,
        safe_max_dimension,
        probe_elapsed,
        decode_elapsed,
        persist_elapsed,
        resize_elapsed,
        started.elapsed().as_millis()
    );

    Ok(PrepareNodeImageResponseDto {
        image_path,
        preview_image_path,
        aspect_ratio: reduce_aspect_ratio(width, height),
    })
}

pub fn prepare_from_bytes(
    app_data_dir: &Path,
    bytes: &[u8],
    extension: &str,
    max_preview_dimension: u32,
) -> Result<PrepareNodeImageResponseDto, String> {
    if bytes.is_empty() {
        return Err("Image bytes are empty".to_string());
    }

    let safe_max_dimension = max_preview_dimension.clamp(64, 4096);
    prepare_node_image_from_bytes(
        app_data_dir,
        bytes,
        &normalize_extension(extension),
        safe_max_dimension,
        "binary",
    )
}

pub async fn prepare_from_source(
    app_data_dir: &Path,
    source: &str,
    max_preview_dimension: u32,
) -> Result<PrepareNodeImageResponseDto, String> {
    let started = Instant::now();
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return Err("Image source is empty".to_string());
    }

    let safe_max_dimension = max_preview_dimension.clamp(64, 4096);
    let resolve_started = Instant::now();
    let (bytes, extension) = resolve_source_bytes(trimmed).await?;
    let resolve_elapsed = resolve_started.elapsed().as_millis();
    let result = prepare_node_image_from_bytes(
        app_data_dir,
        &bytes,
        &extension,
        safe_max_dimension,
        "source",
    )?;
    info!(
        "prepare_from_source resolved: bytes={}, ext={}, resolve_source={}ms, total={}ms",
        bytes.len(),
        extension,
        resolve_elapsed,
        started.elapsed().as_millis()
    );
    Ok(result)
}
