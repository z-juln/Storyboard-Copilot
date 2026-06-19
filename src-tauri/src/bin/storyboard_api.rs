use storyboard_copilot_lib::http;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,storyboard_copilot=debug".into()),
        )
        .init();

    let db_path = http::resolve_api_db_path_standalone();
    if let Err(err) = http::start_http_server_with_db(db_path).await {
        eprintln!("failed to start storyboard-api: {err}");
        std::process::exit(1);
    }

    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl-c");
}
