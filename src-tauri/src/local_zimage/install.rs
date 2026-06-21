use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use super::LocalZImageService;

const APP_PY: &str = include_str!("app.py");
const PYTHON_MIN_VERSION: (u32, u32) = (3, 10);
const UV_VERSION: &str = "0.6.14";

pub const INSTALL_STEPS: [&str; 5] = ["prepare", "python", "venv", "dependencies", "finalize"];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InstallStateFile {
    #[serde(default)]
    pub completed_steps: Vec<String>,
    #[serde(default)]
    pub bootstrap_python: Option<String>,
    #[serde(default)]
    pub system_python_detected: bool,
}

pub fn read_install_state(root_dir: &Path) -> InstallStateFile {
    let path = root_dir.join("install-state.json");
    if !path.is_file() {
        return InstallStateFile::default();
    }
    std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

pub fn write_install_state(root_dir: &Path, state: &InstallStateFile) -> Result<(), String> {
    std::fs::create_dir_all(root_dir).map_err(|err| format!("创建目录失败: {err}"))?;
    std::fs::write(
        root_dir.join("install-state.json"),
        serde_json::to_string_pretty(state).map_err(|err| format!("序列化安装状态失败: {err}"))?,
    )
    .map_err(|err| format!("写入安装状态失败: {err}"))
}

pub fn next_recommended_step(state: &InstallStateFile, installed: bool) -> Option<String> {
    if installed {
        return None;
    }
    for step in INSTALL_STEPS {
        if step == "python" && state.system_python_detected {
            continue;
        }
        if !state.completed_steps.iter().any(|item| item == step) {
            return Some(step.to_string());
        }
    }
    None
}

pub async fn probe_system_python() -> Option<PathBuf> {
    find_system_python(PYTHON_MIN_VERSION).await
}

pub async fn run_install_step(service: Arc<LocalZImageService>, step: &str) -> Result<(), String> {
    match step {
        "prepare" => step_prepare(&service).await,
        "python" => step_python(&service).await,
        "venv" => step_venv(&service).await,
        "dependencies" => step_dependencies(&service).await,
        "finalize" => step_finalize(&service).await,
        _ => Err(format!("未知安装步骤：{step}")),
    }
}

async fn step_prepare(service: &Arc<LocalZImageService>) -> Result<(), String> {
    std::fs::create_dir_all(service.root_dir())
        .map_err(|err| format!("创建安装目录失败: {err}"))?;
    service.set_install_phase("准备安装目录", 8.0).await;

    let mut state = read_install_state(service.root_dir());
    let detected = find_system_python(PYTHON_MIN_VERSION).await;
    state.system_python_detected = detected.is_some();
    if let Some(path) = detected {
        service.push_log(format!("检测到系统 Python: {}", path.display()));
        state.bootstrap_python = Some(path.to_string_lossy().to_string());
        push_completed_step(&mut state, "python");
        service.push_log("已自动跳过「配置 Python」步骤，将直接使用系统 Python".to_string());
    } else {
        service.push_log("未检测到合适的系统 Python，后续需通过 uv 安装 Python 3.12".to_string());
    }
    push_completed_step(&mut state, "prepare");
    write_install_state(service.root_dir(), &state)?;
    Ok(())
}

async fn step_python(service: &Arc<LocalZImageService>) -> Result<(), String> {
    ensure_prior_steps(service, "python")?;
    service.set_install_phase("配置 Python 环境", 22.0).await;

    let mut state = read_install_state(service.root_dir());
    let bootstrap = if let Some(path) = state.bootstrap_python.as_ref().map(PathBuf::from) {
        if path.is_file() {
            path
        } else {
            resolve_bootstrap_python(service, &mut state).await?
        }
    } else {
        resolve_bootstrap_python(service, &mut state).await?
    };

    state.bootstrap_python = Some(bootstrap.to_string_lossy().to_string());
    push_completed_step(&mut state, "python");
    write_install_state(service.root_dir(), &state)?;
    Ok(())
}

async fn step_venv(service: &Arc<LocalZImageService>) -> Result<(), String> {
    ensure_prior_steps(service, "venv")?;
    service.set_install_phase("创建虚拟环境", 38.0).await;

    let state = read_install_state(service.root_dir());
    let python = state
        .bootstrap_python
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| "缺少 Python 引导路径，请先完成 Python 步骤".to_string())?;

    let venv_dir = service.root_dir().join("venv");
    if !service.venv_python().is_file() {
        run_logged_command(
            service,
            Command::new(&python)
                .arg("-m")
                .arg("venv")
                .arg(&venv_dir)
                .current_dir(service.root_dir()),
        )
        .await?;
    }

    if !service.venv_python().is_file() {
        return Err("虚拟环境创建失败".to_string());
    }

    let mut next_state = state;
    push_completed_step(&mut next_state, "venv");
    write_install_state(service.root_dir(), &next_state)?;
    Ok(())
}

async fn step_dependencies(service: &Arc<LocalZImageService>) -> Result<(), String> {
    ensure_prior_steps(service, "dependencies")?;
    service.set_install_phase("安装 Python 依赖", 55.0).await;

    let venv_python = service.venv_python();
    if !venv_python.is_file() {
        return Err("虚拟环境不存在，请先完成「创建虚拟环境」步骤".to_string());
    }

    let requirements = service.root_dir().join("requirements.txt");
    std::fs::write(
        &requirements,
        "torch\ntorchvision\ntransformers\naccelerate\nsafetensors\nsentencepiece\ngradio\nhuggingface_hub\nprotobuf\ngit+https://github.com/huggingface/diffusers.git\n",
    )
    .map_err(|err| format!("写入 requirements 失败: {err}"))?;

    run_logged_command(
        service,
        Command::new(&venv_python)
            .args(["-m", "pip", "install", "--upgrade", "pip"])
            .current_dir(service.root_dir()),
    )
    .await?;

    run_logged_command(
        service,
        Command::new(&venv_python)
            .args(["-m", "pip", "install", "-r", "requirements.txt"])
            .current_dir(service.root_dir()),
    )
    .await?;

    let mut state = read_install_state(service.root_dir());
    push_completed_step(&mut state, "dependencies");
    write_install_state(service.root_dir(), &state)?;
    Ok(())
}

async fn step_finalize(service: &Arc<LocalZImageService>) -> Result<(), String> {
    ensure_prior_steps(service, "finalize")?;
    service.set_install_phase("写入服务脚本", 92.0).await;

    std::fs::write(service.app_py_path(), APP_PY)
        .map_err(|err| format!("写入 app.py 失败: {err}"))?;

    let venv_python = service.venv_python();
    service.mark_installed(venv_python.clone()).await;

    let mut state = read_install_state(service.root_dir());
    push_completed_step(&mut state, "finalize");
    write_install_state(service.root_dir(), &state)?;
    service.push_log("本地 Z-Image 安装完成".to_string());
    Ok(())
}

async fn resolve_bootstrap_python(
    service: &Arc<LocalZImageService>,
    state: &mut InstallStateFile,
) -> Result<PathBuf, String> {
    if let Some(path) = find_system_python(PYTHON_MIN_VERSION).await {
        state.system_python_detected = true;
        return Ok(path);
    }
    install_python_via_uv(service).await
}

fn ensure_prior_steps(service: &Arc<LocalZImageService>, step: &str) -> Result<(), String> {
    let state = read_install_state(service.root_dir());
    let index = INSTALL_STEPS
        .iter()
        .position(|item| *item == step)
        .ok_or_else(|| format!("未知安装步骤：{step}"))?;
    for prior in INSTALL_STEPS.iter().take(index) {
        if !state.completed_steps.iter().any(|item| item == prior) {
            return Err(format!("请先完成步骤：{prior}"));
        }
    }
    Ok(())
}

fn push_completed_step(state: &mut InstallStateFile, step: &str) {
    if !state.completed_steps.iter().any(|item| item == step) {
        state.completed_steps.push(step.to_string());
    }
}

async fn find_system_python(min_version: (u32, u32)) -> Option<PathBuf> {
    let min_major = min_version.0;
    let min_minor = min_version.1;
    let script = format!(
        "import sys; assert sys.version_info >= ({min_major}, {min_minor}); print(sys.executable)"
    );
    for candidate in [
        "python3",
        "/usr/bin/python3",
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
    ] {
        let output = Command::new(candidate)
            .args(["-c", &script])
            .output()
            .await
            .ok()?;
        if !output.status.success() {
            continue;
        }
        let executable = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if executable.is_empty() {
            continue;
        }
        let path = PathBuf::from(executable);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

async fn install_python_via_uv(service: &Arc<LocalZImageService>) -> Result<PathBuf, String> {
    let uv_path = ensure_uv_binary(service.root_dir()).await?;
    service.push_log(format!("uv 路径: {}", uv_path.display()));

    run_logged_command(
        service,
        Command::new(&uv_path)
            .args(["python", "install", "3.12"])
            .env("UV_PYTHON_INSTALL_DIR", service.root_dir().join("python"))
            .current_dir(service.root_dir()),
    )
    .await?;

    let find_output = Command::new(&uv_path)
        .args(["python", "find", "3.12"])
        .env("UV_PYTHON_INSTALL_DIR", service.root_dir().join("python"))
        .output()
        .await
        .map_err(|err| format!("查找 uv Python 失败: {err}"))?;
    if !find_output.status.success() {
        return Err(format!(
            "uv 未找到 Python 3.12: {}",
            String::from_utf8_lossy(&find_output.stderr)
        ));
    }

    let python_path = PathBuf::from(String::from_utf8_lossy(&find_output.stdout).trim());
    if !python_path.is_file() {
        return Err("uv 安装的 Python 路径无效".to_string());
    }
    Ok(python_path)
}

async fn ensure_uv_binary(root_dir: &Path) -> Result<PathBuf, String> {
    let tools_dir = root_dir.join("tools/uv");
    std::fs::create_dir_all(&tools_dir).map_err(|err| format!("创建 tools 目录失败: {err}"))?;
    let uv_path = tools_dir.join("uv");
    if uv_path.is_file() {
        return Ok(uv_path);
    }

    let arch = std::env::consts::ARCH;
    let asset = match arch {
        "aarch64" => format!("uv-aarch64-apple-darwin.tar.gz"),
        "x86_64" => format!("uv-x86_64-apple-darwin.tar.gz"),
        other => return Err(format!("暂不支持的 Mac 架构: {other}")),
    };
    let url = format!("https://github.com/astral-sh/uv/releases/download/{UV_VERSION}/{asset}");
    let bytes = reqwest::get(&url)
        .await
        .map_err(|err| format!("下载 uv 失败: {err}"))?
        .bytes()
        .await
        .map_err(|err| format!("读取 uv 包失败: {err}"))?;

    let archive_path = tools_dir.join("uv.tar.gz");
    std::fs::write(&archive_path, bytes).map_err(|err| format!("写入 uv 包失败: {err}"))?;

    let status = Command::new("tar")
        .args(["-xzf", archive_path.to_str().unwrap(), "-C", tools_dir.to_str().unwrap()])
        .status()
        .await
        .map_err(|err| format!("解压 uv 失败: {err}"))?;
    if !status.success() {
        return Err("解压 uv 失败".to_string());
    }

    if !uv_path.is_file() {
        return Err("uv 二进制未找到".to_string());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&uv_path)
            .map_err(|err| format!("读取 uv 权限失败: {err}"))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&uv_path, perms)
            .map_err(|err| format!("设置 uv 可执行权限失败: {err}"))?;
    }

    Ok(uv_path)
}

async fn run_logged_command(service: &Arc<LocalZImageService>, command: &mut Command) -> Result<(), String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|err| format!("启动命令失败: {err}"))?;

    if let Some(stdout) = child.stdout.take() {
        let service_ref = Arc::clone(service);
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if !line.trim().is_empty() {
                    service_ref.push_log(line);
                }
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let service_ref = Arc::clone(service);
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if !line.trim().is_empty() {
                    service_ref.push_log(line);
                }
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|err| format!("等待命令失败: {err}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("命令执行失败，退出码: {status}"))
    }
}

// 兼容旧的一键安装入口
pub async fn run_install(service: Arc<LocalZImageService>) -> Result<(), String> {
    for step in INSTALL_STEPS {
        run_install_step(Arc::clone(&service), step).await?;
    }
    Ok(())
}
