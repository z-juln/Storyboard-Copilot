use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{header, HeaderMap, Method, StatusCode},
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
use crate::clipboard::{
    clear_project_assets_clipboard_cut_marker, read_project_assets_from_clipboard,
    write_project_assets_to_clipboard, WriteProjectAssetsClipboardRequestDto,
};
use crate::media::dto::{
    CompleteAssetUploadRequestDto, CompleteImageUploadRequestDto,
    EmbedStoryboardMetadataRequestDto, MergeStoryboardImagesPayload, PrepareFromSourceRequestDto,
};
use crate::media::read_local_file_with_range;
use crate::media::read_local_image;
use crate::media::preview_cache::resolve_asset_preview_file;
use crate::media::store::prepare_from_source;
use crate::media::upload::{
    cleanup_stale_upload_sessions, complete_asset_upload_session, complete_upload_session,
    create_upload_session, remove_upload_session, write_upload_chunk, UPLOAD_CHUNK_SIZE,
};
use crate::project::dto::{
    CreateAssetDirectoryRequestDto, ImportProjectAssetsRequestDto, MoveProjectAssetRequestDto,
    ProjectChatHistorySnapshotDto, ProjectSnapshot, RenameProjectRequestDto,
    UpdateProjectViewportRequestDto,
};
use crate::project::file_store;
use crate::project::git;
use crate::project::git_dto::{
    GitPluginStatusDto, ProjectGitBlobQuery, ProjectGitCheckoutRequestDto,
    ProjectGitCommitRequestDto, ProjectGitCommitsQuery, ProjectGitRevertRequestDto,
};
use crate::project::storage;
use crate::local_zimage::{
    ExternalTechRunRequestDto, ExternalTechRunResponseDto, LocalZImageService,
    LocalZImageStatusDto, RunInstallStepRequestDto, StopLocalZImageServerRequestDto,
    SubmitLocalZImageJobRequestDto, SubmitLocalZImageJobResponseDto,
    LocalZImageActiveJobsDto, LocalZImageJobStatusDto,
};
use crate::project::ProjectService;

#[derive(Clone)]
pub struct HttpState {
    pub ai: Arc<AiService>,
    pub project: Arc<ProjectService>,
    pub app_data_dir: PathBuf,
    pub local_zimage: Arc<LocalZImageService>,
}

#[derive(Debug, Deserialize)]
struct ImagePathQuery {
    path: String,
}

#[derive(Debug, Deserialize)]
struct ProjectAssetQuery {
    path: String,
}

#[derive(Debug, Deserialize)]
struct ProjectAssetPreviewQuery {
    path: String,
    max: Option<u32>,
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
    directories::ProjectDirs::from("com", "video", "copilot")
        .map(|dirs| dirs.data_dir().to_path_buf())
        .unwrap_or_else(|| std::env::temp_dir().join("video-copilot"))
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

    let local_zimage = LocalZImageService::new(app_data_dir.clone());
    local_zimage.resume_running_jobs();
    let state = HttpState {
        ai: Arc::new(AiService::new(ai_db_path)),
        project: Arc::new(ProjectService::new(app_data_dir.clone())),
        app_data_dir,
        local_zimage,
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
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers(Any)
        .expose_headers([
            header::ACCEPT_RANGES,
            header::CONTENT_RANGE,
            header::CONTENT_LENGTH,
        ]);

    let upload_routes = Router::new()
        .route(
            "/api/v1/projects/:project_id/images/upload-sessions/:upload_id/chunks/:chunk_index",
            put(upload_image_chunk),
        )
        .route(
            "/api/v1/projects/:project_id/assets/upload-sessions/:upload_id/chunks/:chunk_index",
            put(upload_asset_chunk),
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
        .route(
            "/api/v1/projects/:project_id/chat-history",
            get(get_project_chat_history).put(save_project_chat_history),
        )
        .route("/api/v1/projects/:project_id/rename", put(rename_project))
        .route(
            "/api/v1/projects/:project_id/directory",
            get(list_project_directory),
        )
        .route(
            "/api/v1/projects/:project_id/assets/tree",
            get(list_assets_tree),
        )
        .route(
            "/api/v1/projects/:project_id/assets/directories",
            post(create_asset_directory),
        )
        .route(
            "/api/v1/projects/:project_id/assets/:file_name",
            put(put_project_asset),
        )
        .route(
            "/api/v1/projects/:project_id/assets/copy",
            post(copy_project_asset),
        )
        .route(
            "/api/v1/projects/:project_id/assets/import",
            post(import_project_assets),
        )
        .route(
            "/api/v1/clipboard/assets/clear-cut",
            post(clear_project_assets_clipboard_cut),
        )
        .route(
            "/api/v1/projects/:project_id/clipboard/assets",
            get(read_project_assets_clipboard).post(write_project_assets_clipboard),
        )
        .route(
            "/api/v1/projects/:project_id/assets",
            get(serve_project_asset)
                .put(put_project_asset_by_query)
                .patch(move_project_asset)
                .delete(delete_project_asset),
        )
        .route(
            "/api/v1/projects/:project_id/assets/preview",
            get(serve_project_asset_preview),
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
            "/api/v1/projects/:project_id/assets/upload-sessions",
            post(create_asset_upload_session),
        )
        .route(
            "/api/v1/projects/:project_id/assets/upload-sessions/:upload_id/complete",
            post(complete_asset_upload),
        )
        .route(
            "/api/v1/projects/:project_id/assets/upload-sessions/:upload_id",
            delete(abort_asset_upload),
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
        .route("/api/v1/local-zimage/status", get(local_zimage_status))
        .route("/api/v1/local-zimage/install", post(local_zimage_install))
        .route(
            "/api/v1/local-zimage/install/step",
            post(local_zimage_install_step),
        )
        .route(
            "/api/v1/local-zimage/server/start",
            post(local_zimage_server_start),
        )
        .route(
            "/api/v1/local-zimage/server/stop",
            post(local_zimage_server_stop),
        )
        .route(
            "/api/v1/local-zimage/model/warmup",
            post(local_zimage_model_warmup),
        )
        .route("/api/v1/local-zimage/jobs", post(local_zimage_submit_job))
        .route(
            "/api/v1/local-zimage/jobs/active",
            get(local_zimage_active_jobs),
        )
        .route(
            "/api/v1/local-zimage/jobs/:job_id",
            get(local_zimage_get_job),
        )
        .route("/api/v1/external-tech/run", post(external_tech_run))
        .route("/api/v1/plugins/git/status", get(plugins_git_status))
        .route(
            "/api/v1/projects/:project_id/git/status",
            get(project_git_status),
        )
        .route(
            "/api/v1/projects/:project_id/git/storage",
            get(project_git_storage),
        )
        .route(
            "/api/v1/projects/:project_id/git/init",
            post(project_git_init),
        )
        .route(
            "/api/v1/projects/:project_id/git/commits",
            get(project_git_commits),
        )
        .route(
            "/api/v1/projects/:project_id/git/changes",
            get(project_git_changes),
        )
        .route(
            "/api/v1/projects/:project_id/git/commit",
            post(project_git_commit),
        )
        .route(
            "/api/v1/projects/:project_id/git/keep-current",
            post(project_git_keep_current),
        )
        .route(
            "/api/v1/projects/:project_id/git/checkout",
            post(project_git_checkout),
        )
        .route(
            "/api/v1/projects/:project_id/git/revert",
            post(project_git_revert),
        )
        .route(
            "/api/v1/projects/:project_id/git/blob",
            get(project_git_blob),
        )
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

async fn get_project_chat_history(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match state.project.get_chat_history(&project_id) {
        Ok(snapshot) => Json(snapshot).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn save_project_chat_history(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(snapshot): Json<ProjectChatHistorySnapshotDto>,
) -> Response {
    match state.project.save_chat_history(&project_id, snapshot) {
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

async fn list_project_directory(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match state.project.list_directory(&project_id) {
        Ok(directory) => Json(directory).into_response(),
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

async fn list_assets_tree(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match state.project.list_assets_tree(&project_id) {
        Ok(tree) => Json(tree).into_response(),
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

async fn create_asset_directory(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<CreateAssetDirectoryRequestDto>,
) -> Response {
    match state.project.create_asset_directory(&project_id, &request.path) {
        Ok(path) => Json(json!({ "path": path })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn move_project_asset(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<MoveProjectAssetRequestDto>,
) -> Response {
    match state
        .project
        .move_asset(&project_id, &request.from, &request.to)
    {
        Ok((from, to)) => Json(json!({ "from": from, "to": to })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn copy_project_asset(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<MoveProjectAssetRequestDto>,
) -> Response {
    match state
        .project
        .copy_asset(&project_id, &request.from, &request.to)
    {
        Ok((from, to)) => Json(json!({ "from": from, "to": to })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn import_project_assets(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<ImportProjectAssetsRequestDto>,
) -> Response {
    match state
        .project
        .import_assets(&project_id, &request.target_dir, &request.sources)
    {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn read_project_assets_clipboard(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    match read_project_assets_from_clipboard(&state.app_data_dir, &project_id) {
        Ok(payload) => Json(payload).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn write_project_assets_clipboard(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<WriteProjectAssetsClipboardRequestDto>,
) -> Response {
    match write_project_assets_to_clipboard(
        &state.app_data_dir,
        &project_id,
        &request.relative_paths,
        request.cut,
    ) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn clear_project_assets_clipboard_cut() -> Response {
    match clear_project_assets_clipboard_cut_marker() {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn delete_project_asset(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectAssetQuery>,
) -> Response {
    match state.project.delete_asset(&project_id, &query.path) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
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

async fn upload_asset_chunk(
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

async fn create_asset_upload_session(
    State(state): State<HttpState>,
    Path(_project_id): Path<String>,
) -> Response {
    match create_upload_session(&state.app_data_dir) {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn complete_asset_upload(
    State(state): State<HttpState>,
    Path((project_id, upload_id)): Path<(String, String)>,
    Json(request): Json<CompleteAssetUploadRequestDto>,
) -> Response {
    match complete_asset_upload_session(
        &state.app_data_dir,
        &project_id,
        &upload_id,
        request,
    ) {
        Ok(path) => Json(json!({ "path": path })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn abort_asset_upload(
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

async fn put_project_asset_by_query(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectAssetQuery>,
    body: Bytes,
) -> Response {
    match state
        .project
        .write_asset_at_path(&project_id, &query.path, &body)
    {
        Ok(path) => Json(json!({ "path": path })).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err),
    }
}

async fn serve_project_asset_preview(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectAssetPreviewQuery>,
) -> Response {
    let max_dimension = query.max.unwrap_or(512);
    match resolve_asset_preview_file(
        &state.app_data_dir,
        &project_id,
        &query.path,
        max_dimension,
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

async fn serve_project_asset(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectAssetQuery>,
    headers: HeaderMap,
) -> Response {
    let range = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());
    match crate::project::file_store::read_project_asset(
        &state.app_data_dir,
        &project_id,
        &query.path,
    ) {
        Ok(path) => match read_local_file_with_range(
            &state.app_data_dir,
            &path.to_string_lossy(),
            range,
        ) {
            Ok(result) => local_file_into_response(result),
            Err(err) => api_error(StatusCode::NOT_FOUND, err),
        },
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

fn local_file_into_response(result: crate::media::LocalFileResponse) -> Response {
    let status = StatusCode::from_u16(result.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let mut response = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, result.content_type)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, result.body.len());
    if let Some(content_range) = result.content_range {
        response = response.header(header::CONTENT_RANGE, content_range);
    }
    response
        .body(axum::body::Body::from(result.body))
        .unwrap_or_else(|_| api_error(StatusCode::INTERNAL_SERVER_ERROR, "构建响应失败".to_string()))
}

async fn serve_image(
    State(state): State<HttpState>,
    Query(query): Query<ImagePathQuery>,
    headers: HeaderMap,
) -> Response {
    let range = headers
        .get(header::RANGE)
        .and_then(|value| value.to_str().ok());
    match read_local_file_with_range(&state.app_data_dir, &query.path, range) {
        Ok(result) => local_file_into_response(result),
        Err(err) => api_error(StatusCode::NOT_FOUND, err),
    }
}

async fn local_zimage_status(State(state): State<HttpState>) -> Json<LocalZImageStatusDto> {
    Json(state.local_zimage.status().await)
}

async fn local_zimage_install_step(
    State(state): State<HttpState>,
    Json(payload): Json<RunInstallStepRequestDto>,
) -> Result<Json<LocalZImageStatusDto>, Response> {
    state
        .local_zimage
        .run_install_step(payload.step.trim())
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
    Ok(Json(state.local_zimage.status().await))
}

async fn local_zimage_install(State(state): State<HttpState>) -> Result<Json<LocalZImageStatusDto>, Response> {
    state
        .local_zimage
        .start_install()
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
    Ok(Json(state.local_zimage.status().await))
}

async fn local_zimage_server_start(
    State(state): State<HttpState>,
) -> Result<Json<LocalZImageStatusDto>, Response> {
    state
        .local_zimage
        .start_server()
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
    LocalZImageService::trigger_model_warmup(&state.local_zimage);
    Ok(Json(state.local_zimage.status().await))
}

async fn local_zimage_model_warmup(
    State(state): State<HttpState>,
) -> Result<Json<LocalZImageStatusDto>, Response> {
    state
        .local_zimage
        .warmup_model()
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
    Ok(Json(state.local_zimage.status().await))
}

async fn local_zimage_server_stop(
    State(state): State<HttpState>,
    payload: Option<Json<StopLocalZImageServerRequestDto>>,
) -> Result<Json<LocalZImageStatusDto>, Response> {
    let force = payload.map(|value| value.force).unwrap_or(false);
    state
        .local_zimage
        .stop_server(force)
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
    Ok(Json(state.local_zimage.status().await))
}

async fn local_zimage_submit_job(
    State(state): State<HttpState>,
    Json(payload): Json<SubmitLocalZImageJobRequestDto>,
) -> Result<Json<SubmitLocalZImageJobResponseDto>, Response> {
    state
        .local_zimage
        .submit_generation_job(payload)
        .await
        .map(Json)
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))
}

async fn local_zimage_active_jobs(
    State(state): State<HttpState>,
) -> Json<LocalZImageActiveJobsDto> {
    let count = state.local_zimage.count_active_jobs().unwrap_or(0);
    Json(LocalZImageActiveJobsDto { count })
}

async fn local_zimage_get_job(
    State(state): State<HttpState>,
    Path(job_id): Path<String>,
) -> Result<Json<LocalZImageJobStatusDto>, Response> {
    state
        .local_zimage
        .get_generation_job(job_id.trim())
        .await
        .map(Json)
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))
}

async fn external_tech_run(
    State(state): State<HttpState>,
    Json(payload): Json<ExternalTechRunRequestDto>,
) -> Result<Json<ExternalTechRunResponseDto>, Response> {
    let mut response = state
        .local_zimage
        .run_external_tech(payload.clone())
        .await
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;

    if let Some(project_id) = payload
        .project_id
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        if let Some(source) = response.outputs.get("image").cloned() {
            let prepared = prepare_from_source(
                &state.app_data_dir,
                project_id,
                &source,
                512,
            )
            .await
            .map_err(|error| api_error(StatusCode::BAD_REQUEST, error))?;
            response
                .outputs
                .insert("image".to_string(), prepared.image_path);
        }
    }

    Ok(Json(response))
}

async fn plugins_git_status() -> Response {
    match tokio::task::spawn_blocking(git::git_plugin_status).await {
        Ok(status) => Json(status).into_response(),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("检测 Git 失败: {err}"),
        ),
    }
}

async fn project_git_status(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::project_status(&project_dir)
    })
    .await
    {
        Ok(Ok(status)) => Json(status).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("读取 Git 状态失败: {err}"),
        ),
    }
}

async fn project_git_storage(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        storage::measure_project_storage(&project_id_for_task, &project_dir)
    })
    .await
    {
        Ok(Ok(snapshot)) => Json(snapshot).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("计算项目占用失败: {err}"),
        ),
    }
}

async fn project_git_init(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::init_repo(&project_id_for_task, &project_dir)
    })
    .await
    {
        Ok(Ok(())) => Json(json!({ "ok": true })).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("初始化 Git 失败: {err}"),
        ),
    }
}

async fn project_git_commits(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectGitCommitsQuery>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    let limit = query.limit.unwrap_or(50);
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::list_commits(&project_dir, limit)
    })
    .await
    {
        Ok(Ok(commits)) => Json(commits).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("读取提交历史失败: {err}"),
        ),
    }
}

async fn project_git_changes(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::list_changes(&project_dir)
    })
    .await
    {
        Ok(Ok(changes)) => Json(changes).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("读取未提交变更失败: {err}"),
        ),
    }
}

async fn project_git_commit(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<ProjectGitCommitRequestDto>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    let message = request.message;
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::commit_all(&project_id_for_task, &project_dir, &message)
    })
    .await
    {
        Ok(Ok(())) => Json(json!({ "ok": true })).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("提交失败: {err}"),
        ),
    }
}

async fn project_git_keep_current(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::keep_current_version(&project_id_for_task, &project_dir)
    })
    .await
    {
        Ok(Ok(())) => Json(json!({ "ok": true })).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("仅保留当前版本失败: {err}"),
        ),
    }
}

async fn project_git_checkout(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<ProjectGitCheckoutRequestDto>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    let commit = request.commit;
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::checkout_commit(&project_id_for_task, &project_dir, &commit)
    })
    .await
    {
        Ok(Ok(())) => Json(json!({ "ok": true })).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("切换版本失败: {err}"),
        ),
    }
}

async fn project_git_revert(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Json(request): Json<ProjectGitRevertRequestDto>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    let path = request.path;
    let kind = request.kind;
    let old_path = request.old_path;
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::revert_change(
            &project_id_for_task,
            &project_dir,
            &path,
            &kind,
            old_path.as_deref(),
        )
    })
    .await
    {
        Ok(Ok(())) => Json(json!({ "ok": true })).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("回退失败: {err}"),
        ),
    }
}

async fn project_git_blob(
    State(state): State<HttpState>,
    Path(project_id): Path<String>,
    Query(query): Query<ProjectGitBlobQuery>,
) -> Response {
    let app_data_dir = state.app_data_dir.clone();
    let project_id_for_task = project_id.clone();
    let commit = query.commit;
    let path = query.path;
    match tokio::task::spawn_blocking(move || {
        let project_dir = file_store::resolve_project_dir(&app_data_dir, &project_id_for_task);
        git::read_blob(&project_dir, &commit, &path)
    })
    .await
    {
        Ok(Ok(blob)) => Json(blob).into_response(),
        Ok(Err(err)) => api_error(StatusCode::BAD_REQUEST, err),
        Err(err) => api_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("读取版本文件失败: {err}"),
        ),
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
