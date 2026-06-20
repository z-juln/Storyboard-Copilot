use std::collections::HashSet;
use std::fs;
use std::path::Path;

use cocoa::base::{id, nil};
use cocoa::foundation::{NSArray, NSString};
use objc::{class, msg_send, runtime::Class, sel, sel_impl};

use super::cut_marker_type;

const NS_FILENAMES_PBOARD_TYPE: &str = "NSFilenamesPboardType";
const NS_UTF8_PLAIN_TEXT_TYPE: &str = "public.utf8-plain-text";

pub fn write_file_paths(paths: &[String], cut: bool) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    unsafe {
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
        let _: () = msg_send![pasteboard, clearContents];

        let mut urls: Vec<id> = Vec::with_capacity(paths.len());
        for path in paths {
            let is_dir = fs::metadata(path)
                .map(|meta| meta.is_dir())
                .unwrap_or(false);
            let ns_path = NSString::alloc(nil).init_str(path);
            let url: id = msg_send![class!(NSURL), fileURLWithPath:ns_path isDirectory:is_dir];
            urls.push(url);
        }

        let url_array = ns_mutable_array_from_ids(&urls);
        let write_ok: bool = msg_send![pasteboard, writeObjects:url_array];
        if !write_ok {
            return Err("Failed to write file URLs to pasteboard".to_string());
        }

        let mut ns_paths: Vec<id> = Vec::with_capacity(paths.len());
        for path in paths {
            ns_paths.push(NSString::alloc(nil).init_str(path));
        }
        let filenames_array = ns_mutable_array_from_ids(&ns_paths);
        let filenames_type = NSString::alloc(nil).init_str(NS_FILENAMES_PBOARD_TYPE);
        let set_ok: bool =
            msg_send![pasteboard, setPropertyList:filenames_array forType:filenames_type];
        if !set_ok {
            return Err("Failed to write NSFilenamesPboardType".to_string());
        }

        if paths.len() == 1 {
            if let Some(file_name) = Path::new(&paths[0]).file_name().and_then(|name| name.to_str()) {
                let plain_type = NSString::alloc(nil).init_str(NS_UTF8_PLAIN_TEXT_TYPE);
                let plain_value = NSString::alloc(nil).init_str(file_name);
                let _: () = msg_send![pasteboard, setString:plain_value forType:plain_type];
            }
        }

        if cut {
            let cut_type = NSString::alloc(nil).init_str(cut_marker_type());
            let marker = NSString::alloc(nil).init_str("1");
            let _: () = msg_send![pasteboard, setString:marker forType:cut_type];
        }
    }

    Ok(())
}

pub fn read_file_paths() -> Result<(Vec<String>, bool), String> {
    unsafe {
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
        let cut = read_cut_marker(pasteboard);

        let mut paths = read_filenames_pboard_type(pasteboard);
        paths.extend(read_url_objects(pasteboard));

        Ok((dedupe_existing_paths(paths), cut))
    }
}

pub fn clear_cut_marker() -> Result<(), String> {
    unsafe {
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
        let cut_type = NSString::alloc(nil).init_str(cut_marker_type());
        let _: () = msg_send![pasteboard, setString:nil forType:cut_type];
    }
    Ok(())
}

unsafe fn ns_mutable_array_from_ids(items: &[id]) -> id {
    let array: id = msg_send![class!(NSMutableArray), arrayWithCapacity:items.len()];
    for item in items {
        let _: () = msg_send![array, addObject:*item];
    }
    array
}

unsafe fn read_cut_marker(pasteboard: id) -> bool {
    let cut_type = NSString::alloc(nil).init_str(cut_marker_type());
    let marker: id = msg_send![pasteboard, stringForType:cut_type];
    !marker.is_null()
}

unsafe fn read_filenames_pboard_type(pasteboard: id) -> Vec<String> {
    let filenames_type = NSString::alloc(nil).init_str(NS_FILENAMES_PBOARD_TYPE);
    let property_list: id = msg_send![pasteboard, propertyListForType:filenames_type];
    if property_list != nil {
        let from_plist = read_string_array(property_list);
        if !from_plist.is_empty() {
            return from_plist;
        }
    }

    let string_value: id = msg_send![pasteboard, stringForType:filenames_type];
    if string_value != nil {
        if let Some(path) = nsstring_to_path(string_value) {
            if !path.starts_with("<?xml") {
                return vec![path];
            }
        }
    }

    Vec::new()
}

unsafe fn read_url_objects(pasteboard: id) -> Vec<String> {
    let Some(url_class) = Class::get("NSURL") else {
        return Vec::new();
    };

    let classes: id = msg_send![class!(NSArray), arrayWithObject:url_class];
    let options: id = msg_send![class!(NSDictionary), dictionary];
    let objects: id = msg_send![pasteboard, readObjectsForClasses:classes options:options];
    if objects == nil {
        return Vec::new();
    }

    let count: usize = msg_send![objects, count];
    let mut paths = Vec::with_capacity(count);
    for index in 0..count {
        let url: id = msg_send![objects, objectAtIndex:index];
        if let Some(path) = nsurl_to_path(url) {
            paths.push(path);
        }
    }
    paths
}

unsafe fn read_string_array(value: id) -> Vec<String> {
    let responds_to_count: bool = msg_send![value, respondsToSelector: sel!(count)];
    if !responds_to_count {
        if let Some(path) = nsstring_to_path(value) {
            return vec![path];
        }
        return Vec::new();
    }

    let count: usize = msg_send![value, count];
    let mut paths = Vec::with_capacity(count);
    for index in 0..count {
        let item: id = msg_send![value, objectAtIndex:index];
        if item == nil {
            continue;
        }
        if let Some(path) = nsstring_to_path(item) {
            paths.push(path);
        }
    }
    paths
}

unsafe fn nsurl_to_path(url: id) -> Option<String> {
    if url == nil {
        return None;
    }

    let mut path: id = msg_send![url, path];
    if path == nil || nsstring_to_path(path).is_none() {
        let file_path_url: id = msg_send![url, filePathURL];
        if file_path_url != nil {
            path = msg_send![file_path_url, path];
        }
    }

    nsstring_to_path(path)
}

unsafe fn nsstring_to_path(value: id) -> Option<String> {
    if value == nil {
        return None;
    }

    let cstr: *const i8 = msg_send![value, UTF8String];
    if cstr.is_null() {
        return None;
    }
    let path = std::ffi::CStr::from_ptr(cstr).to_string_lossy().into_owned();
    if path.is_empty() || path.starts_with("file:///.file/id=") {
        return None;
    }
    Some(path)
}

fn dedupe_existing_paths(paths: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut result = Vec::new();

    for path in paths {
        let Some(normalized) = normalize_existing_path(&path) else {
            continue;
        };
        if seen.insert(normalized.clone()) {
            result.push(normalized);
        }
    }

    result
}

fn normalize_existing_path(path: &str) -> Option<String> {
    let candidate = Path::new(path);
    if !candidate.exists() {
        return None;
    }
    fs::canonicalize(candidate)
        .ok()
        .map(|value| value.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn read_current_system_clipboard_snapshot() {
        let (paths, cut) = read_file_paths().expect("read clipboard");
        eprintln!("cut={cut} paths={paths:?}");
    }

    #[test]
    fn roundtrip_file_paths_matches_filenames_type() {
        let temp_dir = std::env::temp_dir().join(format!(
            "storyboard-clipboard-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&temp_dir).expect("create temp dir");
        let file_path = temp_dir.join("sample.txt");
        {
            let mut file = std::fs::File::create(&file_path).expect("create temp file");
            file.write_all(b"clipboard").expect("write temp file");
        }

        let path_str = file_path.to_string_lossy().into_owned();
        write_file_paths(&[path_str.clone()], false).expect("write clipboard");
        let (read_paths, cut) = read_file_paths().expect("read clipboard");

        assert!(!cut);
        assert!(
            read_paths.iter().any(|path| Path::new(path) == file_path.canonicalize().unwrap()),
            "expected {:?} in {:?}",
            file_path,
            read_paths
        );

        let _ = std::fs::remove_file(&file_path);
        let _ = std::fs::remove_dir(temp_dir);
    }
}
