use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{header, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use tauri::AppHandle;
use tauri::Manager;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::ai::dto::{
    HealthResponseDto, InvokeModelAdapterRequestDto, ModelCallResultDto,
    PollModelAdapterRequestDto, SetProviderSecretRequestDto,
};
use crate::ai::service::AiService;
use crate::media::dto::{
    CompleteImageUploadRequestDto, EmbedStoryboardMetadataRequestDto,
    MergeStoryboardImagesPayload, PrepareFromSourceRequestDto,
};
use crate::media::read_local_image;
use crate::media::store::prepare_from_source;
use crate::media::upload::{
    cleanup_stale_upload_sessions, complete_upload_session, create_upload_session,
    remove_upload_session, write_upload_chunk, UPLOAD_CHUNK_SIZE,
};
use crate::project::dto::{ProjectSnapshot, RenameProjectRequestDto, UpdateProjectViewportRequestDto};
use crate::project::ProjectService;

#[derive(Clone)]
pub struct HttpState {
    pub ai: Arc<AiService>,
    pub project: Arc<ProjectService>,
    pub app_data_dir: PathBuf,
}

#[derive(Debug, Deserialize)]
struct ImagePathQuery {
    path: String,
}

#[derive(Debug, Deserialize)]
struct ProjectAssetQuery {
    path: String,
}

pub fn resolve_app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|err| format!("Failed to create app data dir: {err}"))?;
    Ok(app_data_dir)
}

pub fn resolve_api_app_data_dir_standalone() -> PathBuf {
    directories::ProjectDirs::from("com", "storyboard", "copilot")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| std::env::temp_dir().join("storyboard-copilot"))
}

pub async fn start_http_server(app: AppHandle) -> Result<(), String> {
    let app_data_dir = resolve_app_data_dir(&app)?;
    start_http_server_with_app_data(app_data_dir).await
}

pub async fn start_http_server_with_app_data(app_data_dir: PathBuf) -> Result<(), String> {
    let host = std::env::var("STORYBOARD_API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("STORYBOARD_API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(1421);

    let ai_db_path = app_data_dir.join("projects.db");

    let _ = cleanup_stale_upload_sessions(&app_data_dir);

    let state = HttpState {
        ai: Arc::new(AiService::new(ai_db_path)),
        project: Arc::new(ProjectService::new(app_data_dir.clone())),
        app_data_dir,
    };

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:1420".parse().unwrap(),
            "http://127.0.0.1:1420".parse().unwrap(),
        ])
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(Any);

    let upload_routes = Router::new()
        .route(
            "/api/v1/projects/:project_id/images/upload-sessions/:upload_id/chunks/:chunk_index",
            put(upload_image_chunk),
        )
        .layer(DefaultBodyLimit::max(UPLOAD_CHUNK_SIZE + 4096));

    let router = Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/adapters", get(list_adapters))
        .route("/api/v1/adapters/invoke", post(invoke_adapter))
        .route("/api/v1/adapters/poll", post(poll_adapter))
        .route("/api/v1/secrets/:provider_id", get(get_secret_status))
        .route("/api/v1/secrets/:provider_id", put(set_secret))
        .route("/api/v1/projects", get(list_projects))
        .route("/api/v1/projects/:project_id", get(get_project))
        .route("/api/v1/projects/:project_id", put(upsert_project))
        .route("/api/v1/projects/:project_id", delete(delete_project))
        .route(
            "/api/v1/projects/:project_id/viewport",
            put(update_project_viewport),
        )
        .route("/api/v1/projects/:project_id/rename", put(rename_project))
        .route(
            "/api/v1/projects/:project_id/assets/:file_name",
            put(put_project_asset),
        )
        .route(
            "/api/v1/projects/:project_id/assets",
            get(serve_project_asset),
        )
        .route(
            "/api/v1/projects/:project_id/images/upload-sessions",
            post(create_image_upload_session),
        )
        .route(
            "/api/v1/projects/:project_id/images/upload-sessions/:upload_id/complete",
            post(complete_image_upload),
        )
        .route(
            "/api/v1/projects/:project_id/images/upload-sessions/:upload_id",
            delete(abort_image_upload),
        )
        .route(
            "/api/v1/projects/:project_id/images/prepare-from-source",
            post(prepare_image_from_source),
        )
        .route(
            "/api/v1/projects/:project_id/storyboard/merge",
            post(merge_storyboard_images),
        )
        .route(
            "/api/v1/projects/:project_id/storyboard/embed-metadata",
            post(embed_storyboard_metadata),
        )
        .route("/api/v1/image", get(serve_image))
        .route("/image", get(serve_image))
        .merge(upload_routes)
        .layer(cors)
        .with_state(state);

    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .map_err(|err| format!("Invalid API bind address: {err}"))?;

    info!("Starting local AI HTTP API at http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|err| format!("Failed to bind AI HTTP API: {err}"))?;

    tokio::spawn(async move {
        if let Err(err) = axum::serve(listener, router).await {
            tracing::error!("AI HTTP API server exited: {err}");
        }
    });

    Ok(())
}

pub async fn start_http_server_with_db(db_path: PathBuf) -> Result<(), String> {
    let app_data_dir = db_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| db_path.clone());
    start_http_server_with_app_data(app_data_dir).await
}

async fn health() -> Json<HealthResponseDto> {
    Json(HealthResponseDto {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn list_adapters(State(state): State<HttpState>) -> Json<serde_json::Value> {
    Json(json!({ "adapters": state.ai.list_adapters() }))
}

async fn invoke_adapter(
    State(state): State<HttpState>,
    Json(request): Json<InvokeModelAdapterRequestDto>,
) -> Response {
    match state.ai.invoke_adapter(request).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err.to_string()),
    }
}

async fn poll_adapter(
    State(state): State<HttpState>,
    Json(request): Json<PollModelAdapterRequestDto>,
) -> Response {
    match state.ai.poll_adapter(request).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err.to_string()),
    }
}

async fn get_secret_status(
    State(state): State<HttpState>,
    Path(provider_id): Path<String>,
) -> Response {
    match state.ai.secret_status(&provider_id) {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn set_secret(
    State(state): State<HttpState>,
    Path(provider_id): Path<String>,
    Json(request): Json<SetProviderSecretRequestDto>,
) -> Response {
    match state.ai.set_provider_secret(&provider_id, &request.api_key) {
        Ok(()) => match state.ai.secret_status(&provider_id) {
            Ok(result) => Json(result).into_response(),
            Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
        },
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn list_projects(State(state): State<HttpState>) -> Response {
    match state.project.list_summaries() {
        Ok(projects) => Json(json!({ "projects": projects })).into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn get_project(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match state.project.get_snapshot(&project_id) {
        Ok(Some(snapshot)) => Json(snapshot).into_response(),
        Ok(None) => api_error(StatusCode::NOT_FOUND, format!("项目不存在: {project_id}")),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn upsert_project(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(snapshot): Json<ProjectSnapshot>,
) -> Response {
    if snapshot.id != project_id {
        return api_error(
            StatusCode::BAD_REQUEST,
            "路径 projectId 与请求体 id 不一致".to_string(),
        );
    }

    match state.project.upsert_snapshot(snapshot) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn update_project_viewport(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<UpdateProjectViewportRequestDto>,
) -> Response {
    let viewport = match serde_json::from_str(&request.viewport_json) {
        Ok(value) => value,
        Err(err) => return api_error(StatusCode::BAD_REQUEST, format!("Invalid viewport_json: {err}")),
    };

    match state.project.update_viewport(&project_id, viewport) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn rename_project(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<RenameProjectRequestDto>,
) -> Response {
    match state
        .project
        .rename(&project_id, &request.name, request.updated_at)
    {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn delete_project(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match state.project.delete(&project_id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn create_image_upload_session(
    State(state): State<HttpState>,
    Path(_project_id): Path<String>,
) -> Response {
    match create_upload_session(&state.app_data_dir) {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn upload_image_chunk(
    State(state): State<HttpState>,
    Path((_project_id, upload_id, chunk_index)): Path<(String, String, u32)>,
    body: Bytes,
) -> Response {
    match write_upload_chunk(&state.app_data_dir, &upload_id, chunk_index, &body) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn complete_image_upload(
    State(state): State<HttpState>,
    Path((project_id, upload_id)): Path<(String, String)>,
    Json(request): Json<CompleteImageUploadRequestDto>,
) -> Response {
    match complete_upload_session(&state.app_data_dir, &project_id, &upload_id, request) {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn abort_image_upload(
    State(state): State<HttpState>,
    Path((_project_id, upload_id)): Path<(String, String)>,
) -> Response {
    match remove_upload_session(&state.app_data_dir, &upload_id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn prepare_image_from_source(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<PrepareFromSourceRequestDto>,
) -> Response {
    if request.source.trim().starts_with("data:") {
        return api_error(
            StatusCode::BAD_REQUEST,
            "Data URL is too large for JSON upload; use chunked upload API".to_string(),
        );
    }

    let max_preview = request.max_preview_dimension.unwrap_or(512);
    match prepare_from_source(
        &state.app_data_dir,
        &project_id,
        &request.source,
        max_preview,
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn merge_storyboard_images(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(payload): Json<MergeStoryboardImagesPayload>,
) -> Response {
    match crate::commands::image::merge_storyboard_images_for_project(
        &state.app_data_dir,
        &project_id,
        payload,
    )
    .await
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn embed_storyboard_metadata(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<EmbedStoryboardMetadataRequestDto>,
) -> Response {
    match crate::commands::image::embed_storyboard_image_metadata_for_project(
        &state.app_data_dir,
        &project_id,
        &request.source,
        &request.metadata,
    )
    .await
    {
        Ok(path) => Json(json!({ "path": path })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn put_project_asset(
    State(state): State<HttpState>,
    Path((project_id, file_name)): Path<(String, String)>,
    body: Bytes,
) -> Response {
    match crate::project::file_store::write_project_asset(
        &state.app_data_dir,
        &project_id,
        &file_name,
        &body,
    ) {
        Ok(path) => Json(json!({ "path": path })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn serve_project_asset(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectAssetQuery>,
) -> Response {
    match crate::project::file_store::read_project_asset(
        &state.app_data_dir,
        &project_id,
        &query.path,
    ) {
        Ok(path) => match read_local_image(&state.app_data_dir, &path.to_string_lossy()) {
            Ok((bytes, mime)) => (
                StatusCode::OK,
                [(header::CONTENT_TYPE, mime)],
                bytes,
            )
                .into_response(),
            Err(err) => api_error(StatusCode::NOT_FOUND, err),
        },
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

async fn serve_image(
    State(state): State<HttpState>,
    Query(query): Query<ImagePathQuery>,
) -> Response {
    match read_local_image(&state.app_data_dir, &query.path) {
        Ok((bytes, mime)) => (
            StatusCode::OK,
            [(header::CONTENT_TYPE, mime)],
            bytes,
        )
            .into_response(),
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

fn api_error(status: StatusCode, error: String) -> Response {
    (
        status,
        Json(json!({
            "error": error,
        })),
    )
        .into_response()
}

#[allow(dead_code)]
pub fn is_success_result(result: &ModelCallResultDto) -> bool {
    matches!(result, ModelCallResultDto::Succeeded { .. })
}
