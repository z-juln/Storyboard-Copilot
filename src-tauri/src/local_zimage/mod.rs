mod gradio_client;
mod install;
mod jobs;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

pub use install::{
    next_recommended_step, probe_system_python, read_install_state, run_install, run_install_step,
    InstallStateFile, INSTALL_STEPS,
};
pub use jobs::{
    LocalZImageActiveJobsDto, LocalZImageJobStatusDto, SubmitLocalZImageJobRequestDto,
    SubmitLocalZImageJobResponseDto,
};

pub const DEFAULT_SERVER_URL: &str = "http://127.0.0.1:7860";
pub const DEFAULT_SERVER_PORT: u16 = 7860;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunInstallStepRequestDto {
    pub step: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StopLocalZImageServerRequestDto {
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Default, Deserialize)]
struct ModelStatusFile {
    #[serde(default)]
    loaded: bool,
    #[serde(default)]
    loading: bool,
    #[serde(default)]
    phase: String,
    #[serde(default)]
    progress: f32,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct LocalZImageStatusDto {
    pub installed: bool,
    pub install_running: bool,
    pub install_phase: String,
    pub install_progress: f32,
    pub install_error: Option<String>,
    pub python_path: Option<String>,
    pub venv_ready: bool,
    pub server_running: bool,
    pub server_url: String,
    pub log_tail: Vec<String>,
    pub completed_steps: Vec<String>,
    pub system_python_detected: bool,
    pub next_recommended_step: Option<String>,
    pub needs_setup: bool,
    pub detected_system_python: Option<String>,
    pub server_detached: bool,
    pub model_loaded: bool,
    pub model_loading: bool,
    pub model_phase: String,
    pub model_progress: f32,
    pub model_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalTechRunRequestDto {
    pub provider_id: String,
    pub prompt: String,
    #[serde(default)]
    pub inputs: std::collections::HashMap<String, String>,
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExternalTechRunResponseDto {
    pub outputs: std::collections::HashMap<String, String>,
}

pub struct LocalZImageService {
    app_data_dir: PathBuf,
    root_dir: PathBuf,
    status: Arc<RwLock<LocalZImageStatusDto>>,
    log_lines: Arc<Mutex<Vec<String>>>,
    initial_server_running: Mutex<Option<bool>>,
    session_spawned_server: Mutex<bool>,
    job_workers: Arc<RwLock<HashSet<String>>>,
}

impl LocalZImageService {
    pub fn new(app_data_dir: PathBuf) -> Arc<Self> {
        let root_dir = app_data_dir.join("local-zimage");
        let mut initial = LocalZImageStatusDto::default();
        initial.server_url = DEFAULT_SERVER_URL.to_string();
        let service = Arc::new(Self {
            app_data_dir,
            root_dir,
            status: Arc::new(RwLock::new(initial)),
            log_lines: Arc::new(Mutex::new(Vec::new())),
            initial_server_running: Mutex::new(None),
            session_spawned_server: Mutex::new(false),
            job_workers: Arc::new(RwLock::new(HashSet::new())),
        });
        service.refresh_sync_state();
        service
    }

    pub fn root_dir(&self) -> &Path {
        &self.root_dir
    }

    pub fn venv_python(&self) -> PathBuf {
        self.root_dir.join("venv/bin/python")
    }

    pub fn app_py_path(&self) -> PathBuf {
        self.root_dir.join("app.py")
    }

    pub fn installed_marker(&self) -> PathBuf {
        self.root_dir.join("installed.json")
    }

    pub fn server_pid_path(&self) -> PathBuf {
        self.root_dir.join("gradio-server.pid")
    }

    pub async fn status(&self) -> LocalZImageStatusDto {
        self.refresh_server_state().await;
        let install_state = read_install_state(&self.root_dir);
        let mut status = self.status.read().await.clone();
        status.log_tail = self.tail_logs(40);
        status.completed_steps = install_state.completed_steps.clone();

        let prepare_done = install_state
            .completed_steps
            .iter()
            .any(|item| item == "prepare");
        if prepare_done {
            status.system_python_detected = install_state.system_python_detected;
            status.detected_system_python = install_state.bootstrap_python.clone();
        } else if let Some(path) = probe_system_python().await {
            status.system_python_detected = true;
            status.detected_system_python = Some(path.to_string_lossy().to_string());
        } else {
            status.system_python_detected = false;
            status.detected_system_python = None;
        }

        status.next_recommended_step =
            next_recommended_step(&install_state, status.installed);
        status.needs_setup = !status.installed || !status.server_running;
        status
    }

    pub fn push_log(&self, line: impl Into<String>) {
        let line = line.into();
        tracing::info!(target: "local_zimage", "{line}");
        let mut logs = self.log_lines.lock().expect("log lock");
        logs.push(line);
        if logs.len() > 400 {
            let drain = logs.len() - 400;
            logs.drain(0..drain);
        }
    }

    pub async fn set_install_phase(&self, phase: impl Into<String>, progress: f32) {
        let mut status = self.status.write().await;
        status.install_phase = phase.into();
        status.install_progress = progress.clamp(0.0, 100.0);
    }

    pub async fn set_install_running(&self, running: bool) {
        let mut status = self.status.write().await;
        status.install_running = running;
        if !running {
            if status.installed {
                status.install_phase = "完成".to_string();
                status.install_progress = 100.0;
            } else {
                status.install_phase.clear();
                status.install_progress = 0.0;
            }
        }
    }

    pub async fn set_install_error(&self, error: impl Into<String>) {
        let message = error.into();
        self.push_log(format!("ERROR: {message}"));
        let mut status = self.status.write().await;
        status.install_error = Some(message);
        status.install_running = false;
    }

    pub async fn mark_installed(&self, python_path: PathBuf) {
        let payload = serde_json::json!({
            "python_path": python_path.to_string_lossy(),
            "venv_ready": true,
        });
        let _ = std::fs::create_dir_all(&self.root_dir);
        let _ = std::fs::write(
            self.installed_marker(),
            serde_json::to_string_pretty(&payload).unwrap_or_default(),
        );
        let mut status = self.status.write().await;
        status.installed = true;
        status.venv_ready = true;
        status.python_path = Some(python_path.to_string_lossy().to_string());
        status.install_error = None;
        status.install_phase = "完成".to_string();
        status.install_progress = 100.0;
        status.install_running = false;
    }

    pub fn refresh_sync_state(&self) {
        let installed = self.installed_marker().is_file() && self.venv_python().is_file();
        let venv_ready = self.venv_python().is_file();
        let python_path = if venv_ready {
            Some(self.venv_python().to_string_lossy().to_string())
        } else {
            None
        };

        if let Ok(mut status) = self.status.try_write() {
            status.installed = installed;
            status.venv_ready = venv_ready;
            status.python_path = python_path;
            status.server_url = DEFAULT_SERVER_URL.to_string();
        }
    }

    pub async fn refresh_server_state(&self) {
        self.refresh_sync_state();
        let reachable = gradio_client::probe_server(DEFAULT_SERVER_URL).await;
        let pid_alive = self
            .read_server_pid()
            .map(|pid| is_process_alive(pid))
            .unwrap_or(false);

        if !reachable && pid_alive {
            self.clear_server_pid();
        }

        {
            let mut initial = self
                .initial_server_running
                .lock()
                .expect("initial server lock");
            if initial.is_none() {
                *initial = Some(reachable);
            }
        }

        let boot_had_server = self
            .initial_server_running
            .lock()
            .expect("initial server lock")
            .unwrap_or(false);
        let spawned_this_session = *self
            .session_spawned_server
            .lock()
            .expect("session spawned lock");
        let server_detached = reachable && boot_had_server && !spawned_this_session;

        if let Ok(mut status) = self.status.try_write() {
            status.server_running = reachable;
            status.server_detached = server_detached;
            if !reachable {
                status.model_loaded = false;
                status.model_loading = false;
                status.model_phase.clear();
                status.model_progress = 0.0;
                status.model_error = None;
            } else {
                self.apply_model_status(&mut status);
            }
        }
        if reachable {
            self.recover_server_pid_from_port();
        }
    }

    fn model_status_path(&self) -> PathBuf {
        self.root_dir.join("model-status.json")
    }

    fn read_model_status_file(&self) -> ModelStatusFile {
        let raw = std::fs::read_to_string(self.model_status_path()).unwrap_or_default();
        if raw.trim().is_empty() {
            return ModelStatusFile::default();
        }
        serde_json::from_str(&raw).unwrap_or_default()
    }

    fn apply_model_status(&self, status: &mut LocalZImageStatusDto) {
        let model = self.read_model_status_file();
        status.model_loaded = model.loaded;
        status.model_loading = model.loading;
        status.model_phase = model.phase;
        status.model_progress = model.progress.clamp(0.0, 100.0);
        status.model_error = model.error.filter(|value| !value.trim().is_empty());

        if status.server_detached && !status.model_loaded && !status.model_loading {
            status.model_phase = if status.model_phase.is_empty() {
                "遗留服务：模型可能仍在内存中".to_string()
            } else {
                status.model_phase.clone()
            };
        } else if !status.model_loaded
            && !status.model_loading
            && status.model_phase.is_empty()
        {
            status.model_phase = "首次生成时将加载模型".to_string();
        }
    }

    pub async fn warmup_model(&self) -> Result<(), String> {
        if !gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            return Err("Z-Image 服务未运行，请先启动服务".to_string());
        }
        gradio_client::call_warmup(DEFAULT_SERVER_URL).await
    }

    pub fn trigger_model_warmup(service: &Arc<Self>) {
        let service = Arc::clone(service);
        tokio::spawn(async move {
            if gradio_client::probe_server(DEFAULT_SERVER_URL).await {
                if let Err(error) = gradio_client::call_warmup(DEFAULT_SERVER_URL).await {
                    service.push_log(format!("模型预加载启动失败: {error}"));
                } else {
                    service.push_log("已开始后台预加载 Z-Image 模型".to_string());
                }
            }
        });
    }

    fn read_server_pid(&self) -> Option<u32> {
        let raw = std::fs::read_to_string(self.server_pid_path()).ok()?;
        raw.trim().parse().ok()
    }

    fn write_server_pid(&self, pid: u32) {
        let _ = std::fs::write(self.server_pid_path(), pid.to_string());
    }

    fn clear_server_pid(&self) {
        let _ = std::fs::remove_file(self.server_pid_path());
    }

    fn recover_server_pid_from_port(&self) {
        if self.read_server_pid().is_some() {
            return;
        }
        if let Some(pid) = find_listeners_on_port(DEFAULT_SERVER_PORT)
            .into_iter()
            .next()
        {
            self.write_server_pid(pid);
        }
    }

    fn tail_logs(&self, count: usize) -> Vec<String> {
        let logs = self.log_lines.lock().expect("log lock");
        if logs.len() <= count {
            return logs.clone();
        }
        logs[logs.len() - count..].to_vec()
    }

    pub async fn run_install_step(self: &Arc<Self>, step: &str) -> Result<(), String> {
        {
            let status = self.status.read().await;
            if status.install_running {
                return Err("安装任务已在进行中".to_string());
            }
            if status.installed && step != "prepare" {
                return Ok(());
            }
        }

        {
            let mut status = self.status.write().await;
            status.install_error = None;
        }
        self.set_install_running(true).await;

        let service = Arc::clone(self);
        let step_id = step.to_string();
        tokio::spawn(async move {
            let result = install::run_install_step(Arc::clone(&service), &step_id).await;
            match result {
                Ok(()) => {
                    service.set_install_running(false).await;
                }
                Err(err) => {
                    service.set_install_error(err).await;
                }
            }
        });
        Ok(())
    }

    pub async fn start_install(self: &Arc<Self>) -> Result<(), String> {
        {
            let status = self.status.read().await;
            if status.install_running {
                return Err("安装任务已在进行中".to_string());
            }
            if status.installed && self.venv_python().is_file() {
                return Ok(());
            }
        }

        {
            let mut status = self.status.write().await;
            status.install_error = None;
        }
        self.set_install_running(true).await;
        self.set_install_phase("准备安装", 1.0).await;

        let service = Arc::clone(self);
        tokio::spawn(async move {
            if let Err(err) = run_install(Arc::clone(&service)).await {
                service.set_install_error(err).await;
            } else {
                service.set_install_running(false).await;
            }
        });
        Ok(())
    }

    pub async fn start_server(&self) -> Result<(), String> {
        self.refresh_server_state().await;
        if !self.venv_python().is_file() {
            return Err("本地 Z-Image 尚未安装，请先在设置中完成安装".to_string());
        }

        self.sync_app_py()?;

        if gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            if gradio_client::supports_job_api(DEFAULT_SERVER_URL).await {
                let status = self.status.read().await;
                if status.server_running && status.server_detached {
                    drop(status);
                    self.recover_server_pid_from_port();
                    self.push_log(
                        "检测到上次未关闭的 Z-Image 服务，已直接复用（模型可能仍在内存中）".to_string(),
                    );
                }
                self.refresh_server_state().await;
                return Ok(());
            }

            self.push_log("检测到 Z-Image 服务版本过旧，正在重启以加载新 API…".to_string());
            self.stop_server(true).await?;
        }

        std::fs::create_dir_all(&self.root_dir)
            .map_err(|err| format!("创建目录失败: {err}"))?;

        let python = self.venv_python();
        let app_py = self.app_py_path();
        if !app_py.is_file() {
            return Err("缺少 app.py，请重新安装本地 Z-Image".to_string());
        }

        let mut command = std::process::Command::new(&python);
        command
            .arg(&app_py)
            .current_dir(&self.root_dir)
            .env("ZIMAGE_PORT", DEFAULT_SERVER_PORT.to_string())
            .env("ZIMAGE_HOST", "127.0.0.1")
            .env("ZIMAGE_DEFAULT_SIZE", "768")
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            unsafe {
                command.pre_exec(|| {
                    libc::setsid();
                    Ok(())
                });
            }
        }

        let child = command
            .spawn()
            .map_err(|err| format!("启动 Gradio 失败: {err}"))?;
        let pid = child.id();
        self.write_server_pid(pid);
        {
            let mut spawned = self
                .session_spawned_server
                .lock()
                .expect("session spawned lock");
            *spawned = true;
        }
        std::mem::forget(child);

        self.push_log(format!("Gradio 服务已启动（PID {pid}，关闭应用后仍会继续运行）"));
        for _ in 0..60 {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            if gradio_client::probe_server(DEFAULT_SERVER_URL).await {
                self.push_log("Gradio 服务已就绪，正在后台预加载模型…".to_string());
                self.refresh_server_state().await;
                return Ok(());
            }
            if !is_process_alive(pid) {
                self.clear_server_pid();
                return Err("Gradio 进程已退出，请查看安装日志".to_string());
            }
        }

        Err("Gradio 启动超时，请稍后重试".to_string())
    }

    fn sync_app_py(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.root_dir)
            .map_err(|err| format!("创建目录失败: {err}"))?;
        std::fs::write(self.app_py_path(), include_str!("app.py"))
            .map_err(|err| format!("写入 app.py 失败: {err}"))?;
        Ok(())
    }

    pub async fn stop_server(&self, force: bool) -> Result<(), String> {
        let active_jobs = self.count_active_jobs()?;
        if active_jobs > 0 && !force {
            return Err(format!(
                "当前有 {active_jobs} 个 Z-Image 生成任务进行中，停止服务将中断任务"
            ));
        }
        if active_jobs > 0 {
            self.fail_all_active_jobs("Z-Image 服务已停止，任务已中断")?;
        }

        if let Some(pid) = self.read_server_pid() {
            terminate_process(pid);
            self.clear_server_pid();
            self.push_log("Gradio 服务已停止".to_string());
        } else if gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            let pids = find_listeners_on_port(DEFAULT_SERVER_PORT);
            if pids.is_empty() {
                return Err(
                    "检测到运行中的 Z-Image 服务，但无法定位占用 7860 端口的进程".to_string(),
                );
            }
            for pid in &pids {
                terminate_process(*pid);
            }
            self.push_log(format!(
                "已停止占用 {} 端口的遗留 Gradio 服务 (PID {pids:?})",
                DEFAULT_SERVER_PORT
            ));
        }
        {
            let mut initial = self
                .initial_server_running
                .lock()
                .expect("initial server lock");
            *initial = Some(false);
            let mut spawned = self
                .session_spawned_server
                .lock()
                .expect("session spawned lock");
            *spawned = false;
        }
        self.refresh_server_state().await;
        Ok(())
    }

    pub async fn generate_image(&self, prompt: &str, size: u32) -> Result<String, String> {
        if !gradio_client::probe_server(DEFAULT_SERVER_URL).await {
            self.start_server().await?;
        }
        gradio_client::call_generate(DEFAULT_SERVER_URL, prompt, size).await
    }

    pub async fn run_external_tech(
        &self,
        request: ExternalTechRunRequestDto,
    ) -> Result<ExternalTechRunResponseDto, String> {
        if request.provider_id != "zimage-local" {
            return Err(format!("未知的外部科技场景：{}", request.provider_id));
        }
        let prompt = request
            .inputs
            .get("prompt")
            .map(String::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(request.prompt.as_str())
            .trim()
            .to_string();
        if prompt.is_empty() {
            return Err("请输入提示词或连接文本节点".to_string());
        }
        let size = request
            .inputs
            .get("size")
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(768);
        let image_path = self.generate_image(&prompt, size).await?;
        let mut outputs = std::collections::HashMap::new();
        outputs.insert("image".to_string(), image_path);
        Ok(ExternalTechRunResponseDto { outputs })
    }
}

fn is_process_alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        false
    }
}

fn terminate_process(pid: u32) {
    #[cfg(unix)]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
        for _ in 0..20 {
            if !is_process_alive(pid) {
                return;
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        unsafe {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
    }
}

fn find_listeners_on_port(port: u16) -> Vec<u32> {
    #[cfg(unix)]
    {
        let output = std::process::Command::new("lsof")
            .args([
                "-nP",
                &format!("-iTCP:{port}"),
                "-sTCP:LISTEN",
                "-t",
            ])
            .output();
        let Ok(output) = output else {
            return Vec::new();
        };
        if !output.status.success() {
            return Vec::new();
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .lines()
            .filter_map(|line| line.trim().parse::<u32>().ok())
            .collect()
    }
    #[cfg(not(unix))]
    {
        let _ = port;
        Vec::new()
    }
}
