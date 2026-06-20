use std::path::{Component, Path, PathBuf};

pub fn resolve_filesystem_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("缺少 path 参数".to_string());
    }

    if trimmed.len() > 7 && trimmed[..7].eq_ignore_ascii_case("file://") {
        let rest = &trimmed[7..];
        let decoded = urlencoding::decode(rest)
            .map_err(|err| format!("无效的 file:// 路径: {err}"))?
            .into_owned();
        let normalized = if cfg!(windows) {
            decoded.trim_start_matches('/').replace('/', "\\")
        } else {
            decoded
        };
        return Ok(PathBuf::from(normalized));
    }

    Ok(PathBuf::from(trimmed))
}

fn reject_parent_dir_traversal(path: &Path) -> Result<(), String> {
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("不允许访问上级目录".to_string());
        }
    }
    Ok(())
}

pub fn read_local_image(app_data_dir: &Path, raw_path: &str) -> Result<(Vec<u8>, &'static str), String> {
    let requested = resolve_filesystem_path(raw_path)?;
    reject_parent_dir_traversal(&requested)?;

    let canonical_app_data = std::fs::canonicalize(app_data_dir)
        .map_err(|err| format!("应用数据目录不可用: {err}"))?;

    let candidate = if requested.is_absolute() {
        requested
    } else {
        canonical_app_data.join(requested)
    };

    reject_parent_dir_traversal(&candidate)?;

    let canonical_file = std::fs::canonicalize(&candidate)
        .map_err(|err| format!("图片不存在: {err}"))?;

    if !canonical_file.starts_with(&canonical_app_data) {
        return Err("仅允许访问应用数据目录内的图片".to_string());
    }

    if !canonical_file.is_file() {
        return Err("目标不是文件".to_string());
    }

    let bytes = std::fs::read(&canonical_file)
        .map_err(|err| format!("读取图片失败: {err}"))?;
    let mime = guess_asset_mime(&canonical_file);

    Ok((bytes, mime))
}

pub fn guess_image_mime(path: &Path) -> &'static str {
    guess_asset_mime(path)
}

pub fn guess_asset_mime(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("tif") | Some("tiff") => "image/tiff",
        Some("avif") => "image/avif",
        Some("svg") => "image/svg+xml",
        Some("mp4") | Some("m4v") => "video/mp4",
        Some("webm") => "video/webm",
        Some("mov") => "video/quicktime",
        Some("mkv") => "video/x-matroska",
        Some("avi") => "video/x-msvideo",
        Some("ogv") => "video/ogg",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("ogg") | Some("opus") => "audio/ogg",
        Some("m4a") => "audio/mp4",
        Some("aac") => "audio/aac",
        Some("flac") => "audio/flac",
        Some("weba") => "audio/webm",
        Some("txt") | Some("log") | Some("csv") => "text/plain; charset=utf-8",
        Some("md") | Some("markdown") => "text/markdown; charset=utf-8",
        Some("json") | Some("jsonc") => "application/json; charset=utf-8",
        Some("html") | Some("htm") => "text/html; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("js") | Some("mjs") | Some("cjs") => "text/javascript; charset=utf-8",
        Some("ts") | Some("tsx") | Some("jsx") => "text/plain; charset=utf-8",
        Some("xml") => "application/xml; charset=utf-8",
        Some("yaml") | Some("yml") => "application/yaml; charset=utf-8",
        _ => "application/octet-stream",
    }
}
