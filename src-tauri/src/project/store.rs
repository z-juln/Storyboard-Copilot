use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{params, Connection};

use super::dto::{ProjectRecord, ProjectSummaryRecord};

pub fn resolve_db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("projects.db")
}

pub fn ensure_app_data_dir(app_data_dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|err| format!("Failed to create app data dir: {err}"))
}

fn ensure_projects_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          node_count INTEGER NOT NULL DEFAULT 0,
          nodes_json TEXT NOT NULL,
          edges_json TEXT NOT NULL,
          viewport_json TEXT NOT NULL,
          history_json TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
        CREATE TABLE IF NOT EXISTS project_image_refs (
          project_id TEXT NOT NULL,
          path TEXT NOT NULL,
          PRIMARY KEY(project_id, path)
        );
        CREATE INDEX IF NOT EXISTS idx_project_image_refs_path ON project_image_refs(path);
        "#,
    )
    .map_err(|err| format!("Failed to initialize projects table: {err}"))?;

    let mut has_node_count = false;
    let mut stmt = conn
        .prepare("PRAGMA table_info(projects)")
        .map_err(|err| format!("Failed to inspect projects schema: {err}"))?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|err| format!("Failed to inspect projects columns: {err}"))?;

    for name_result in rows {
        let column_name =
            name_result.map_err(|err| format!("Failed to read projects column name: {err}"))?;
        if column_name == "node_count" {
            has_node_count = true;
            break;
        }
    }

    if !has_node_count {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN node_count INTEGER NOT NULL DEFAULT 0",
            [],
        )
        .map_err(|err| format!("Failed to add node_count column: {err}"))?;
    }

    Ok(())
}

fn parse_image_pool(history_json: &str) -> Vec<String> {
    let parsed: serde_json::Value = match serde_json::from_str(history_json) {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    parsed
        .get("imagePool")
        .and_then(|value| value.as_array())
        .map(|array| {
            array
                .iter()
                .filter_map(|value| value.as_str().map(|item| item.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn resolve_image_ref(value: &str, image_pool: &[String]) -> Option<String> {
    const IMAGE_REF_PREFIX: &str = "__img_ref__:";

    if let Some(index_text) = value.strip_prefix(IMAGE_REF_PREFIX) {
        let index = index_text.parse::<usize>().ok()?;
        return image_pool.get(index).cloned();
    }

    if value.trim().is_empty() {
        return None;
    }

    Some(value.to_string())
}

fn collect_image_paths_from_nodes(
    nodes: &[serde_json::Value],
    image_pool: &[String],
    paths: &mut HashSet<String>,
) {
    for node in nodes {
        let data = match node.get("data").and_then(|value| value.as_object()) {
            Some(value) => value,
            None => continue,
        };

        for key in ["imageUrl", "previewImageUrl"] {
            if let Some(raw_value) = data.get(key).and_then(|value| value.as_str()) {
                if let Some(path) = resolve_image_ref(raw_value, image_pool) {
                    paths.insert(path);
                }
            }
        }

        if let Some(frames) = data.get("frames").and_then(|value| value.as_array()) {
            for frame in frames {
                let frame_obj = match frame.as_object() {
                    Some(value) => value,
                    None => continue,
                };
                for key in ["imageUrl", "previewImageUrl"] {
                    if let Some(raw_value) = frame_obj.get(key).and_then(|value| value.as_str()) {
                        if let Some(path) = resolve_image_ref(raw_value, image_pool) {
                            paths.insert(path);
                        }
                    }
                }
            }
        }
    }
}

fn extract_project_image_paths(nodes_json: &str, history_json: &str) -> HashSet<String> {
    let image_pool = parse_image_pool(history_json);
    let mut paths = HashSet::new();

    if let Ok(parsed_nodes) = serde_json::from_str::<serde_json::Value>(nodes_json) {
        if let Some(nodes) = parsed_nodes.as_array() {
            collect_image_paths_from_nodes(nodes, &image_pool, &mut paths);
        }
    }

    if let Ok(parsed_history) = serde_json::from_str::<serde_json::Value>(history_json) {
        for timeline_key in ["past", "future"] {
            let Some(timeline) = parsed_history.get(timeline_key).and_then(|value| value.as_array())
            else {
                continue;
            };

            for snapshot in timeline {
                let Some(nodes) = snapshot.get("nodes").and_then(|value| value.as_array()) else {
                    continue;
                };
                collect_image_paths_from_nodes(nodes, &image_pool, &mut paths);
            }
        }
    }

    paths
}

fn resolve_images_dir(app_data_dir: &Path) -> Result<PathBuf, String> {
    let images_dir = app_data_dir.join("images");
    std::fs::create_dir_all(&images_dir)
        .map_err(|err| format!("Failed to create images dir: {err}"))?;
    Ok(images_dir)
}

fn prune_unreferenced_images(db_path: &Path, app_data_dir: &Path) -> Result<(), String> {
    let conn = open_db(db_path)?;
    let mut stmt = conn
        .prepare("SELECT DISTINCT path FROM project_image_refs")
        .map_err(|err| format!("Failed to prepare image refs query: {err}"))?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|err| format!("Failed to query image refs: {err}"))?;

    let mut referenced = HashSet::new();
    for path_result in rows {
        let path = path_result.map_err(|err| format!("Failed to decode image ref row: {err}"))?;
        referenced.insert(path);
    }

    let images_dir = resolve_images_dir(app_data_dir)?;
    let entries = std::fs::read_dir(&images_dir)
        .map_err(|err| format!("Failed to read images dir: {err}"))?;

    for entry_result in entries {
        let entry = entry_result.map_err(|err| format!("Failed to iterate images dir: {err}"))?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let path_string = path.to_string_lossy().to_string();
        if !referenced.contains(&path_string) {
            std::fs::remove_file(&path)
                .map_err(|err| format!("Failed to delete unreferenced image: {err}"))?;
        }
    }

    Ok(())
}

pub fn open_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        ensure_app_data_dir(parent)?;
    }

    let conn = Connection::open(db_path).map_err(|err| format!("Failed to open SQLite DB: {err}"))?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|err| format!("Failed to set journal_mode=WAL: {err}"))?;
    conn.pragma_update(None, "synchronous", "NORMAL")
        .map_err(|err| format!("Failed to set synchronous=NORMAL: {err}"))?;
    conn.pragma_update(None, "temp_store", "MEMORY")
        .map_err(|err| format!("Failed to set temp_store=MEMORY: {err}"))?;
    conn.busy_timeout(Duration::from_millis(3000))
        .map_err(|err| format!("Failed to set busy timeout: {err}"))?;

    ensure_projects_table(&conn)?;
    Ok(conn)
}

pub fn list_project_summaries(db_path: &Path) -> Result<Vec<ProjectSummaryRecord>, String> {
    let conn = open_db(db_path)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              id,
              name,
              created_at,
              updated_at,
              node_count
            FROM projects
            ORDER BY updated_at DESC
            "#,
        )
        .map_err(|err| format!("Failed to prepare list summaries query: {err}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ProjectSummaryRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
                node_count: row.get(4)?,
            })
        })
        .map_err(|err| format!("Failed to query project summaries: {err}"))?;

    let mut projects = Vec::new();
    for row in rows {
        projects.push(row.map_err(|err| format!("Failed to decode summary row: {err}"))?);
    }
    Ok(projects)
}

pub fn get_project_record(
    db_path: &Path,
    project_id: &str,
) -> Result<Option<ProjectRecord>, String> {
    let conn = open_db(db_path)?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT
              id,
              name,
              created_at,
              updated_at,
              node_count,
              nodes_json,
              edges_json,
              viewport_json,
              history_json
            FROM projects
            WHERE id = ?1
            LIMIT 1
            "#,
        )
        .map_err(|err| format!("Failed to prepare get project query: {err}"))?;

    let result = stmt.query_row(params![project_id], |row| {
        Ok(ProjectRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            node_count: row.get(4)?,
            nodes_json: row.get(5)?,
            edges_json: row.get(6)?,
            viewport_json: row.get(7)?,
            history_json: row.get(8)?,
        })
    });

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(format!("Failed to load project: {error}")),
    }
}

pub fn upsert_project_record(
    db_path: &Path,
    app_data_dir: &Path,
    record: ProjectRecord,
) -> Result<(), String> {
    let mut conn = open_db(db_path)?;
    let image_paths = extract_project_image_paths(&record.nodes_json, &record.history_json);
    let tx = conn
        .transaction()
        .map_err(|err| format!("Failed to begin transaction: {err}"))?;

    tx.execute(
        r#"
        INSERT INTO projects (
          id,
          name,
          created_at,
          updated_at,
          node_count,
          nodes_json,
          edges_json,
          viewport_json,
          history_json
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          node_count = excluded.node_count,
          nodes_json = excluded.nodes_json,
          edges_json = excluded.edges_json,
          viewport_json = excluded.viewport_json,
          history_json = excluded.history_json
        "#,
        params![
            record.id,
            record.name,
            record.created_at,
            record.updated_at,
            record.node_count,
            record.nodes_json,
            record.edges_json,
            record.viewport_json,
            record.history_json,
        ],
    )
    .map_err(|err| format!("Failed to upsert project: {err}"))?;

    tx.execute(
        "DELETE FROM project_image_refs WHERE project_id = ?1",
        params![record.id],
    )
    .map_err(|err| format!("Failed to clear project image refs: {err}"))?;

    for path in image_paths {
        tx.execute(
            "INSERT OR IGNORE INTO project_image_refs (project_id, path) VALUES (?1, ?2)",
            params![record.id, path],
        )
        .map_err(|err| format!("Failed to upsert project image ref: {err}"))?;
    }

    tx.commit()
        .map_err(|err| format!("Failed to commit upsert transaction: {err}"))?;

    prune_unreferenced_images(db_path, app_data_dir)?;
    Ok(())
}

pub fn update_project_viewport_record(
    db_path: &Path,
    project_id: &str,
    viewport_json: &str,
) -> Result<(), String> {
    let conn = open_db(db_path)?;
    conn.execute(
        "UPDATE projects SET viewport_json = ?1 WHERE id = ?2",
        params![viewport_json, project_id],
    )
    .map_err(|err| format!("Failed to update project viewport: {err}"))?;
    Ok(())
}

pub fn rename_project_record(
    db_path: &Path,
    project_id: &str,
    name: &str,
    updated_at: i64,
) -> Result<(), String> {
    let conn = open_db(db_path)?;
    conn.execute(
        "UPDATE projects SET name = ?1, updated_at = ?2 WHERE id = ?3",
        params![name, updated_at, project_id],
    )
    .map_err(|err| format!("Failed to rename project: {err}"))?;
    Ok(())
}

pub fn delete_project_record(db_path: &Path, app_data_dir: &Path, project_id: &str) -> Result<(), String> {
    let mut conn = open_db(db_path)?;
    let tx = conn
        .transaction()
        .map_err(|err| format!("Failed to begin delete transaction: {err}"))?;

    tx.execute("DELETE FROM projects WHERE id = ?1", params![project_id])
        .map_err(|err| format!("Failed to delete project: {err}"))?;
    tx.execute(
        "DELETE FROM project_image_refs WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|err| format!("Failed to delete project image refs: {err}"))?;

    tx.commit()
        .map_err(|err| format!("Failed to commit delete transaction: {err}"))?;

    prune_unreferenced_images(db_path, app_data_dir)?;
    Ok(())
}
