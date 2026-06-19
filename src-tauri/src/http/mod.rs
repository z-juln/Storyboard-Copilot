use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
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

#[derive(Clone)]
pub struct HttpState {
    pub service: Arc<AiService>,
}

pub fn resolve_api_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|err| format!("Failed to create app data dir: {err}"))?;
    Ok(app_data_dir.join("projects.db"))
}

pub fn resolve_api_db_path_standalone() -> PathBuf {
    directories::ProjectDirs::from("com", "storyboard", "copilot")
        .map(|dirs| dirs.data_dir().join("projects.db"))
        .unwrap_or_else(|| std::env::temp_dir().join("storyboard-copilot/projects.db"))
}

pub async fn start_http_server(app: AppHandle) -> Result<(), String> {
    let db_path = resolve_api_db_path(&app)?;
    start_http_server_with_db(db_path).await
}

pub async fn start_http_server_with_db(db_path: PathBuf) -> Result<(), String> {
    let host = std::env::var("STORYBOARD_API_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("STORYBOARD_API_PORT")
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
        .unwrap_or(1421);

    let state = HttpState {
        service: Arc::new(AiService::new(db_path)),
    };

    let cors = CorsLayer::new()
        .allow_origin([
            "http://localhost:1420".parse().unwrap(),
            "http://127.0.0.1:1420".parse().unwrap(),
        ])
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::OPTIONS])
        .allow_headers(Any);

    let router = Router::new()
        .route("/api/v1/health", get(health))
        .route("/api/v1/adapters", get(list_adapters))
        .route("/api/v1/adapters/invoke", post(invoke_adapter))
        .route("/api/v1/adapters/poll", post(poll_adapter))
        .route("/api/v1/secrets/:provider_id", get(get_secret_status))
        .route("/api/v1/secrets/:provider_id", put(set_secret))
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

async fn health() -> Json<HealthResponseDto> {
    Json(HealthResponseDto {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn list_adapters(State(state): State<HttpState>) -> Json<serde_json::Value> {
    Json(json!({ "adapters": state.service.list_adapters() }))
}

async fn invoke_adapter(
    State(state): State<HttpState>,
    Json(request): Json<InvokeModelAdapterRequestDto>,
) -> Response {
    match state.service.invoke_adapter(request).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err.to_string()),
    }
}

async fn poll_adapter(
    State(state): State<HttpState>,
    Json(request): Json<PollModelAdapterRequestDto>,
) -> Response {
    match state.service.poll_adapter(request).await {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::BAD_REQUEST, err.to_string()),
    }
}

async fn get_secret_status(
    State(state): State<HttpState>,
    Path(provider_id): Path<String>,
) -> Response {
    match state.service.secret_status(&provider_id) {
        Ok(result) => Json(result).into_response(),
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
    }
}

async fn set_secret(
    State(state): State<HttpState>,
    Path(provider_id): Path<String>,
    Json(request): Json<SetProviderSecretRequestDto>,
) -> Response {
    match state.service.set_provider_secret(&provider_id, &request.api_key) {
        Ok(()) => {
            match state.service.secret_status(&provider_id) {
                Ok(result) => Json(result).into_response(),
                Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
            }
        }
        Err(err) => api_error(StatusCode::INTERNAL_SERVER_ERROR, err),
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
