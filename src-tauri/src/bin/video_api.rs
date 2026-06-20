use video_copilot_lib::http;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,video_copilot=debug".into()),
        )
        .init();

    let app_data_dir = http::resolve_api_app_data_dir_standalone();
    if let Err(err) = http::start_http_server_with_app_data(app_data_dir).await {
        eprintln!("failed to start video-api: {err}");
        std::process::exit(1);
    }

    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl-c");
}
