use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};

pub struct LocalFileResponse {
    pub status_code: u16,
    pub content_type: &'static str,
    pub body: Vec<u8>,
    pub content_range: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ByteRangeError {
    Invalid,
    NotSatisfiable,
}

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

pub fn resolve_local_asset_file(app_data_dir: &Path, raw_path: &str) -> Result<PathBuf, String> {
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
        .map_err(|err| format!("文件不存在: {err}"))?;

    if !canonical_file.starts_with(&canonical_app_data) {
        return Err("仅允许访问应用数据目录内的文件".to_string());
    }

    if !canonical_file.is_file() {
        return Err("目标不是文件".to_string());
    }

    Ok(canonical_file)
}

pub fn read_local_image(app_data_dir: &Path, raw_path: &str) -> Result<(Vec<u8>, &'static str), String> {
    let canonical_file = resolve_local_asset_file(app_data_dir, raw_path)?;
    let bytes = std::fs::read(&canonical_file)
        .map_err(|err| format!("读取文件失败: {err}"))?;
    let mime = guess_asset_mime(&canonical_file);
    Ok((bytes, mime))
}

pub fn read_local_file_with_range(
    app_data_dir: &Path,
    raw_path: &str,
    range_header: Option<&str>,
) -> Result<LocalFileResponse, String> {
    let canonical_file = resolve_local_asset_file(app_data_dir, raw_path)?;
    let mime = guess_asset_mime(&canonical_file);
    let file_size = std::fs::metadata(&canonical_file)
        .map_err(|err| format!("读取文件元数据失败: {err}"))?
        .len();

    if file_size == 0 {
        return Ok(LocalFileResponse {
            status_code: 200,
            content_type: mime,
            body: Vec::new(),
            content_range: None,
        });
    }

    let Some(range_header) = range_header else {
        let bytes = std::fs::read(&canonical_file)
            .map_err(|err| format!("读取文件失败: {err}"))?;
        return Ok(LocalFileResponse {
            status_code: 200,
            content_type: mime,
            body: bytes,
            content_range: None,
        });
    };

    match parse_byte_range(range_header, file_size) {
        Ok(Some((start, end))) => {
            let length = end - start + 1;
            let mut file = std::fs::File::open(&canonical_file)
                .map_err(|err| format!("打开文件失败: {err}"))?;
            file.seek(SeekFrom::Start(start))
                .map_err(|err| format!("定位文件失败: {err}"))?;
            let mut body = vec![0u8; length as usize];
            file.read_exact(&mut body)
                .map_err(|err| format!("读取文件范围失败: {err}"))?;
            Ok(LocalFileResponse {
                status_code: 206,
                content_type: mime,
                body,
                content_range: Some(format!("bytes {start}-{end}/{file_size}")),
            })
        }
        Ok(None) => {
            let bytes = std::fs::read(&canonical_file)
                .map_err(|err| format!("读取文件失败: {err}"))?;
            Ok(LocalFileResponse {
                status_code: 200,
                content_type: mime,
                body: bytes,
                content_range: None,
            })
        }
        Err(ByteRangeError::NotSatisfiable) => Ok(LocalFileResponse {
            status_code: 416,
            content_type: "text/plain; charset=utf-8",
            body: Vec::new(),
            content_range: Some(format!("bytes */{file_size}")),
        }),
        Err(ByteRangeError::Invalid) => Err("无效的 Range 请求头".to_string()),
    }
}

pub fn parse_byte_range(range_header: &str, file_size: u64) -> Result<Option<(u64, u64)>, ByteRangeError> {
    let trimmed = range_header.trim();
    if file_size == 0 {
        return Err(ByteRangeError::NotSatisfiable);
    }

    let Some(spec) = trimmed.strip_prefix("bytes=") else {
        return Ok(None);
    };

    if spec.contains(',') {
        return Ok(None);
    }

    let mut parts = spec.splitn(2, '-');
    let start_part = parts.next().unwrap_or_default();
    let end_part = parts.next().unwrap_or_default();

    let (start, end) = if start_part.is_empty() {
        let suffix: u64 = end_part
            .parse()
            .map_err(|_| ByteRangeError::Invalid)?;
        if suffix == 0 {
            return Err(ByteRangeError::Invalid);
        }
        if suffix > file_size {
            return Err(ByteRangeError::NotSatisfiable);
        }
        (file_size - suffix, file_size - 1)
    } else if end_part.is_empty() {
        let start: u64 = start_part
            .parse()
            .map_err(|_| ByteRangeError::Invalid)?;
        if start >= file_size {
            return Err(ByteRangeError::NotSatisfiable);
        }
        (start, file_size - 1)
    } else {
        let start: u64 = start_part
            .parse()
            .map_err(|_| ByteRangeError::Invalid)?;
        let end: u64 = end_part.parse().map_err(|_| ByteRangeError::Invalid)?;
        if start > end || start >= file_size {
            return Err(ByteRangeError::NotSatisfiable);
        }
        (start, end.min(file_size - 1))
    };

    Ok(Some((start, end)))
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

#[cfg(test)]
mod tests {
    use super::parse_byte_range;

    #[test]
    fn parse_byte_range_inclusive() {
        assert_eq!(parse_byte_range("bytes=0-99", 1000), Ok(Some((0, 99))));
        assert_eq!(parse_byte_range("bytes=500-999", 1000), Ok(Some((500, 999))));
    }

    #[test]
    fn parse_byte_range_open_end() {
        assert_eq!(parse_byte_range("bytes=500-", 1000), Ok(Some((500, 999))));
    }

    #[test]
    fn parse_byte_range_suffix() {
        assert_eq!(parse_byte_range("bytes=-500", 1000), Ok(Some((500, 999))));
    }

    #[test]
    fn parse_byte_range_not_satisfiable() {
        assert_eq!(parse_byte_range("bytes=1000-", 1000), Err(super::ByteRangeError::NotSatisfiable));
    }
}
