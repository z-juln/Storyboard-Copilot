use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPasteItemDto {
    pub absolute_path: String,
    pub project_relative_path: Option<String>,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPastePayloadDto {
    pub mode: String,
    pub items: Vec<ClipboardPasteItemDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteProjectAssetsClipboardRequestDto {
    pub relative_paths: Vec<String>,
    pub cut: bool,
}
