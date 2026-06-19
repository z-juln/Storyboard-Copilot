use rusqlite::{params, Connection};
use std::path::Path;

pub const DEEPSEEK_PROVIDER_ID: &str = "deepseek";
pub const KLING_PROVIDER_ID: &str = "kling";

const DEEPSEEK_BUILTIN_KEY: &str = "sk-1d20780a6a574ed58fe3775359dd1990";
const KLING_BUILTIN_KEY: &str = "api-key-kling-Osjgfnl-YmoLfWkIK9zTCMRmIo5C_if4PuovP7X1Lfc";

pub fn ensure_provider_secrets_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS provider_secrets (
          provider_id TEXT PRIMARY KEY,
          api_key TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        "#,
    )
    .map_err(|err| format!("Failed to initialize provider_secrets table: {err}"))
}

pub fn open_secrets_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create app data dir: {err}"))?;
    }
    let conn = Connection::open(db_path).map_err(|err| format!("Failed to open SQLite DB: {err}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|err| format!("Failed to set journal_mode=WAL: {err}"))?;
    ensure_provider_secrets_table(&conn)?;
    Ok(conn)
}

fn builtin_key(provider_id: &str) -> Option<&'static str> {
    match provider_id {
        DEEPSEEK_PROVIDER_ID => Some(DEEPSEEK_BUILTIN_KEY),
        KLING_PROVIDER_ID => Some(KLING_BUILTIN_KEY),
        _ => None,
    }
}

pub fn resolve_api_key(conn: &Connection, provider_id: &str) -> Option<String> {
    if let Ok(Some(override_key)) = read_override_key(conn, provider_id) {
        let trimmed = override_key.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    builtin_key(provider_id).map(str::to_string)
}

pub fn read_override_key(conn: &Connection, provider_id: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT api_key FROM provider_secrets WHERE provider_id = ?1")
        .map_err(|err| err.to_string())?;
    let mut rows = stmt
        .query(params![provider_id])
        .map_err(|err| err.to_string())?;
    if let Some(row) = rows.next().map_err(|err| err.to_string())? {
        return Ok(Some(row.get(0).map_err(|err| err.to_string())?));
    }
    Ok(None)
}

pub fn set_provider_secret(
    conn: &Connection,
    provider_id: &str,
    api_key: &str,
    now_ms: i64,
) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        conn.execute(
            "DELETE FROM provider_secrets WHERE provider_id = ?1",
            params![provider_id],
        )
        .map_err(|err| err.to_string())?;
        return Ok(());
    }
    conn.execute(
        r#"
        INSERT INTO provider_secrets (provider_id, api_key, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(provider_id) DO UPDATE SET
          api_key = excluded.api_key,
          updated_at = excluded.updated_at
        "#,
        params![provider_id, trimmed, now_ms],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn secret_status(conn: &Connection, provider_id: &str) -> crate::ai::dto::ProviderSecretStatusDto {
    let has_builtin = builtin_key(provider_id).is_some();
    let has_override = read_override_key(conn, provider_id)
        .ok()
        .flatten()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    crate::ai::dto::ProviderSecretStatusDto {
        provider_id: provider_id.to_string(),
        has_override,
        has_builtin,
        using_builtin: has_builtin && !has_override,
    }
}
