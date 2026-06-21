use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::media::store::prepare_from_source;

use super::gradio_client;
use super::{LocalZImageService, DEFAULT_SERVER_URL};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmitLocalZImageJobRequestDto {
    pub prompt: String,
    #[serde(default = "default_job_size")]
    pub size: u32,
    #[serde(default)]
    pub project_id: Option<String>,
}

fn default_job_size() -> u32 {
    768
}

#[derive(Debug, Clone, Serialize)]
pub struct SubmitLocalZImageJobResponseDto {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalZImageActiveJobsDto {
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalZImageJobStatusDto {
    pub job_id: String,
    pub status: String,
    pub result: Option<String>,
    pub error: Option<String>,
    pub phase: Option<String>,
    pub progress: Option<f32>,
}

#[derive(Debug, Clone)]
struct LocalZImageJobRecord {
    job_id: String,
    status: String,
    project_id: Option<String>,
    prompt: String,
    size: u32,
    external_event_id: Option<String>,
    result: Option<String>,
    error: Option<String>,
    phase: Option<String>,
    progress: f32,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn open_jobs_db(app_data_dir: &Path) -> Result<Connection, String> {
    let db_path = app_data_dir.join("projects.db");
    let conn = Connection::open(db_path).map_err(|err| format!("打开任务数据库失败: {err}"))?;
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|err| format!("设置 journal_mode 失败: {err}"))?;
    conn.busy_timeout(Duration::from_millis(3000))
        .map_err(|err| format!("设置 busy_timeout 失败: {err}"))?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS local_zimage_jobs (
          job_id TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          project_id TEXT,
          prompt TEXT NOT NULL,
          size INTEGER NOT NULL,
          external_event_id TEXT,
          result TEXT,
          error TEXT,
          phase TEXT,
          progress REAL NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_local_zimage_jobs_status ON local_zimage_jobs(status);
        "#,
    )
    .map_err(|err| format!("初始化 local_zimage_jobs 表失败: {err}"))?;
    Ok(conn)
}

impl LocalZImageService {
    fn list_running_job_ids(&self) -> Result<Vec<String>, String> {
        let conn = open_jobs_db(&self.app_data_dir)?;
        let mut stmt = conn
            .prepare(
                "SELECT job_id FROM local_zimage_jobs WHERE status IN ('queued', 'running') ORDER BY created_at ASC",
            )
            .map_err(|err| format!("查询运行中任务失败: {err}"))?;
        let rows = stmt
            .query_map([], |row| row.get(0))
            .map_err(|err| format!("读取运行中任务失败: {err}"))?;
        let mut job_ids = Vec::new();
        for row in rows {
            job_ids.push(row.map_err(|err| format!("读取运行中任务失败: {err}"))?);
        }
        Ok(job_ids)
    }

    pub fn resume_running_jobs(self: &Arc<Self>) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            let job_ids = match service.list_running_job_ids() {
                Ok(ids) => ids,
                Err(error) => {
                    service.push_log(format!("恢复 Z-Image 任务失败: {error}"));
                    return;
                }
            };
            if job_ids.is_empty() {
                return;
            }
            service.push_log(format!("恢复 {} 个进行中的 Z-Image 生成任务", job_ids.len()));
            for job_id in job_ids {
                service.spawn_job_worker(job_id);
            }
        });
    }

    pub fn count_active_jobs(&self) -> Result<usize, String> {
        let conn = open_jobs_db(&self.app_data_dir)?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM local_zimage_jobs WHERE status IN ('queued', 'running')",
                [],
                |row| row.get(0),
            )
            .map_err(|err| format!("查询活跃任务失败: {err}"))?;
        Ok(count.max(0) as usize)
    }

    pub fn fail_all_active_jobs(&self, message: &str) -> Result<(), String> {
        let conn = open_jobs_db(&self.app_data_dir)?;
        conn.execute(
            r#"
            UPDATE local_zimage_jobs
            SET status = 'failed', error = ?1, updated_at = ?2
            WHERE status IN ('queued', 'running')
            "#,
            params![message, now_ms()],
        )
        .map_err(|err| format!("标记任务失败时出错: {err}"))?;
        Ok(())
    }

    pub async fn submit_generation_job(
        self: &Arc<Self>,
        request: SubmitLocalZImageJobRequestDto,
    ) -> Result<SubmitLocalZImageJobResponseDto, String> {
        let prompt = request.prompt.trim().to_string();
        if prompt.is_empty() {
            return Err("请输入提示词".to_string());
        }

        if !gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            self.start_server().await?;
        } else if !gradio_client::supports_job_api(DEFAULT_SERVER_URL).await {
            self.start_server().await?;
        }

        let size = match request.size {
            512 | 768 | 1024 => request.size,
            _ => 768,
        };
        let project_id = request
            .project_id
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        let job_id = Uuid::new_v4().to_string();
        let now = now_ms();

        {
            let conn = open_jobs_db(&self.app_data_dir)?;
            conn.execute(
                r#"
                INSERT INTO local_zimage_jobs (
                  job_id, status, project_id, prompt, size, external_event_id,
                  result, error, phase, progress, created_at, updated_at
                ) VALUES (?1, 'running', ?2, ?3, ?4, NULL, NULL, NULL, '提交中', 0, ?5, ?5)
                "#,
                params![job_id, project_id, prompt, size as i64, now],
            )
            .map_err(|err| format!("写入生成任务失败: {err}"))?;
        }

        if let Err(error) = gradio_client::submit_python_generate_job(
            DEFAULT_SERVER_URL,
            &job_id,
            &prompt,
            size,
        )
        .await
        {
            let _ = self.update_job_status(
                &job_id,
                "failed",
                None,
                Some(error.as_str()),
                None,
                None,
            );
            return Err(error);
        }

        let _ = self.update_job_status(
            &job_id,
            "running",
            None,
            None,
            Some("已提交 Python 生成任务"),
            Some(5.0),
        );

        self.spawn_job_worker(job_id.clone());
        Ok(SubmitLocalZImageJobResponseDto { job_id })
    }

    pub async fn get_generation_job(
        self: &Arc<Self>,
        job_id: &str,
    ) -> Result<LocalZImageJobStatusDto, String> {
        let trimmed = job_id.trim();
        if trimmed.is_empty() {
            return Err("缺少 job_id".to_string());
        }

        let record = self.read_job(trimmed)?;
        let Some(record) = record else {
            return Ok(LocalZImageJobStatusDto {
                job_id: trimmed.to_string(),
                status: "not_found".to_string(),
                result: None,
                error: Some("job not found".to_string()),
                phase: None,
                progress: None,
            });
        };

        if record.status == "running" || record.status == "queued" {
            self.maybe_spawn_recovery_worker(trimmed).await;
        }

        let latest = self
            .read_job(trimmed)?
            .unwrap_or(record);
        Ok(job_record_to_dto(&latest))
    }

    fn read_job(&self, job_id: &str) -> Result<Option<LocalZImageJobRecord>, String> {
        let conn = open_jobs_db(&self.app_data_dir)?;
        let mut stmt = conn
            .prepare(
                r#"
                SELECT job_id, status, project_id, prompt, size, external_event_id,
                       result, error, phase, progress
                FROM local_zimage_jobs
                WHERE job_id = ?1
                "#,
            )
            .map_err(|err| format!("读取任务失败: {err}"))?;

        let result = stmt.query_row(params![job_id], |row| {
            Ok(LocalZImageJobRecord {
                job_id: row.get(0)?,
                status: row.get(1)?,
                project_id: row.get(2)?,
                error: row.get(7)?,
                prompt: row.get(3)?,
                size: row.get::<_, i64>(4)? as u32,
                external_event_id: row.get(5)?,
                result: row.get(6)?,
                phase: row.get(8)?,
                progress: row.get(9)?,
            })
        });

        match result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(err) => Err(format!("读取任务失败: {err}")),
        }
    }

    fn update_job_status(
        &self,
        job_id: &str,
        status: &str,
        result: Option<&str>,
        error: Option<&str>,
        phase: Option<&str>,
        progress: Option<f32>,
    ) -> Result<(), String> {
        let conn = open_jobs_db(&self.app_data_dir)?;
        conn.execute(
            r#"
            UPDATE local_zimage_jobs
            SET status = ?1,
                result = COALESCE(?2, result),
                error = ?3,
                phase = COALESCE(?4, phase),
                progress = COALESCE(?5, progress),
                updated_at = ?6
            WHERE job_id = ?7
            "#,
            params![
                status,
                result,
                error,
                phase,
                progress,
                now_ms(),
                job_id
            ],
        )
        .map_err(|err| format!("更新任务状态失败: {err}"))?;
        Ok(())
    }

    fn spawn_job_worker(self: &Arc<Self>, job_id: String) {
        let service = Arc::clone(self);
        tokio::spawn(async move {
            service.run_job_worker(job_id).await;
        });
    }

    async fn maybe_spawn_recovery_worker(self: &Arc<Self>, job_id: &str) {
        let workers = self.job_workers.read().await;
        if workers.contains(job_id) {
            return;
        }
        drop(workers);

        let record = match self.read_job(job_id) {
            Ok(Some(record)) => record,
            _ => return,
        };

        if record.status != "running" && record.status != "queued" {
            return;
        }

        if !gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            return;
        }

        self.spawn_job_worker(job_id.to_string());
    }

    async fn run_job_worker(self: Arc<Self>, job_id: String) {
        {
            let mut workers = self.job_workers.write().await;
            if workers.contains(&job_id) {
                return;
            }
            workers.insert(job_id.clone());
        }

        let cleanup = |service: &Arc<Self>, id: &str| {
            let service = Arc::clone(service);
            let id = id.to_string();
            tokio::spawn(async move {
                let mut workers = service.job_workers.write().await;
                workers.remove(&id);
            });
        };

        let record = match self.read_job(&job_id) {
            Ok(Some(record)) => record,
            _ => {
                cleanup(&self, &job_id);
                return;
            }
        };

        if record.status != "running" && record.status != "queued" {
            cleanup(&self, &job_id);
            return;
        }

        let poll_interval = Duration::from_secs(1);
        let mut resubmitted = false;

        loop {
            if !gradio_client::probe_server(DEFAULT_SERVER_URL).await {
                let _ = self.update_job_status(
                    &job_id,
                    "failed",
                    None,
                    Some("Z-Image 服务不可用"),
                    None,
                    None,
                );
                cleanup(&self, &job_id);
                return;
            }

            let python_status = match gradio_client::poll_python_generate_job(
                DEFAULT_SERVER_URL,
                &job_id,
            )
            .await
            {
                Ok(status) => status,
                Err(error) => {
                    let _ = self.update_job_status(
                        &job_id,
                        "failed",
                        None,
                        Some(error.as_str()),
                        None,
                        None,
                    );
                    cleanup(&self, &job_id);
                    return;
                }
            };

            let phase = if python_status.phase.trim().is_empty() {
                "生成中".to_string()
            } else {
                python_status.phase.clone()
            };

            match python_status.status.as_str() {
                "succeeded" => {
                    let raw_path = python_status.result_path.trim();
                    if raw_path.is_empty() {
                        let _ = self.update_job_status(
                            &job_id,
                            "failed",
                            None,
                            Some("Python 任务成功但未返回图片路径"),
                            None,
                            None,
                        );
                        cleanup(&self, &job_id);
                        return;
                    }

                    let final_path = if let Some(project_id) = record.project_id.as_deref() {
                        match prepare_from_source(
                            &self.app_data_dir,
                            project_id,
                            raw_path,
                            512,
                        )
                        .await
                        {
                            Ok(prepared) => prepared.image_path,
                            Err(error) => {
                                let _ = self.update_job_status(
                                    &job_id,
                                    "failed",
                                    None,
                                    Some(error.as_str()),
                                    None,
                                    None,
                                );
                                cleanup(&self, &job_id);
                                return;
                            }
                        }
                    } else {
                        raw_path.to_string()
                    };

                    let _ = self.update_job_status(
                        &job_id,
                        "succeeded",
                        Some(final_path.as_str()),
                        None,
                        Some("完成"),
                        Some(100.0),
                    );
                    cleanup(&self, &job_id);
                    return;
                }
                "failed" => {
                    let message = python_status
                        .error
                        .unwrap_or_else(|| "Python 生成任务失败".to_string());
                    let _ = self.update_job_status(
                        &job_id,
                        "failed",
                        None,
                        Some(message.as_str()),
                        None,
                        None,
                    );
                    cleanup(&self, &job_id);
                    return;
                }
                "not_found" => {
                    if !resubmitted {
                        if let Err(error) = gradio_client::submit_python_generate_job(
                            DEFAULT_SERVER_URL,
                            &job_id,
                            &record.prompt,
                            record.size,
                        )
                        .await
                        {
                            let _ = self.update_job_status(
                                &job_id,
                                "failed",
                                None,
                                Some(error.as_str()),
                                None,
                                None,
                            );
                            cleanup(&self, &job_id);
                            return;
                        }
                        resubmitted = true;
                        let _ = self.update_job_status(
                            &job_id,
                            "running",
                            None,
                            None,
                            Some("已重新提交 Python 生成任务"),
                            Some(5.0),
                        );
                        tokio::time::sleep(poll_interval).await;
                        continue;
                    }
                    let _ = self.update_job_status(
                        &job_id,
                        "failed",
                        None,
                        Some("Python 侧未找到生成任务"),
                        None,
                        None,
                    );
                    cleanup(&self, &job_id);
                    return;
                }
                "queued" | "running" | "unknown" => {
                    let _ = self.update_job_status(
                        &job_id,
                        "running",
                        None,
                        None,
                        Some(phase.as_str()),
                        Some(python_status.progress.max(5.0)),
                    );
                    tokio::time::sleep(poll_interval).await;
                }
                _ => {
                    let _ = self.update_job_status(
                        &job_id,
                        "running",
                        None,
                        None,
                        Some(phase.as_str()),
                        Some(python_status.progress),
                    );
                    tokio::time::sleep(poll_interval).await;
                }
            }
        }
    }
}

fn job_record_to_dto(record: &LocalZImageJobRecord) -> LocalZImageJobStatusDto {
    LocalZImageJobStatusDto {
        job_id: record.job_id.clone(),
        status: record.status.clone(),
        result: record.result.clone(),
        error: record.error.clone(),
        phase: record.phase.clone(),
        progress: if record.progress > 0.0 {
            Some(record.progress)
        } else {
            None
        },
    }
}
