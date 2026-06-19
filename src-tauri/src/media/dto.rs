use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareNodeImageResponseDto {
    pub image_path: String,
    pub preview_image_path: String,
    pub aspect_ratio: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareFromSourceRequestDto {
    pub source: String,
    pub max_preview_dimension: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateImageUploadSessionResponseDto {
    pub upload_id: String,
    pub chunk_size: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteImageUploadRequestDto {
    pub extension: String,
    pub total_chunks: u32,
    pub max_preview_dimension: Option<u32>,
}
