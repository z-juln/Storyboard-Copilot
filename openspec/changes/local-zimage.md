# 本地 Z-Image 安装与外部科技节点

## 背景

公共 Hugging Face Space 存在 IP / 次数限制。Mac 用户可在本机安装 Z-Image-Turbo（Python + diffusers + Gradio），通过 Storyboard 设置页一键安装，并在「外部科技」节点中调用。

## 目标

- 下载 App 后，在设置 → 内置模型 / 本地 Z-Image 中触发安装（检测 `python3`，缺失则通过 `uv` 安装 Python，无需 Homebrew）。
- 安装完成后启动本地 Gradio 服务（默认 `http://127.0.0.1:7860`）。
- **Web 端与 Tauri 共用**本地 Rust HTTP API（`:1421`），不依赖 Tauri invoke。
- 画布「外部科技」节点支持「Z-Image 本地」场景：文本输入 → 本地生成 → 结果图片节点。

## 架构

```text
Settings UI (LocalZImagePanel)
  → rustApiClient.getLocalZImageStatus / installLocalZImage / startLocalZImageServer
  → POST/GET /api/v1/local-zimage/*
  → local_zimage::Service（安装脚本、venv、子进程 Gradio、Gradio HTTP 调用）

ExternalTechNode (provider: zimage-local)
  → runExternalTech → POST /api/v1/external-tech/run
  → local_zimage 生成 → prepareNodeImage → exportImage 下游节点
```

## 安装流程

1. 检测系统 `python3` 是否 ≥ 3.10。
2. 若无合适 Python：下载 `uv` 到 `app_data/local-zimage/tools/`，执行 `uv python install 3.12`。
3. 在 `app_data/local-zimage/venv` 创建虚拟环境。
4. `pip install`：`torch`、`diffusers`（GitHub 源）、`gradio`、`accelerate` 等。
5. 写入 `app.py`（Gradio + ZImagePipeline，MPS/CUDA/CPU 自动选择）。
6. 标记 `installed`，用户可「启动服务」。

首次生成时从 Hugging Face 拉取 `Tongyi-MAI/Z-Image-Turbo` 权重（约 10GB+），需磁盘空间与网络。

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/local-zimage/status` | 安装/服务状态与日志摘要 |
| POST | `/api/v1/local-zimage/install` | 后台开始安装（幂等：已安装则跳过） |
| POST | `/api/v1/local-zimage/server/start` | 启动 Gradio 子进程 |
| POST | `/api/v1/local-zimage/server/stop` | 停止 Gradio |
| POST | `/api/v1/external-tech/run` | 外部科技执行（含 zimage-local） |

## Web 端使用

1. 终端运行 `cargo run --bin video-api`（或 Tauri 开发时自动启动 `:1421`）。
2. 浏览器打开前端 `npm run dev`。
3. 设置页安装并启动本地 Z-Image，画布使用「外部科技」节点。

## 系统要求（Mac）

- 推荐 Apple Silicon，**16GB+ 统一内存**（24GB 更佳）。
- 磁盘：模型与 venv 建议预留 **20GB+**。
- 首次安装与首次生成需联网。

## 安装流程（分步确认）

1. **首页面板**（可隐藏）：项目管理页顶部展示 6 步安装向导。
2. **每步确认**：用户点击「继续」或「执行下一步」后弹出确认框，确认后才调用 API。
3. **外部科技节点**：若未安装/未启动服务，点击生成会打开安装对话框，不会直接失败静默。

| 步骤 ID | 说明 |
|---------|------|
| `prepare` | 创建目录、检测 Python |
| `python` | 系统 Python 或 uv 安装 Python 3.12 |
| `venv` | 创建虚拟环境 |
| `dependencies` | pip 安装 torch/diffusers/gradio |
| `finalize` | 写入 app.py |
| `start-server` | 启动 Gradio（前端确认，非 install step API） |

`POST /api/v1/local-zimage/install/step` body: `{ "step": "python" }`

## 验收

- [ ] 设置页显示 API 在线/离线，可触发安装并轮询状态。
- [ ] 每个安装大步骤需用户确认后才执行。
- [ ] 首页安装面板可隐藏，设置中可重新显示。
- [ ] 外部科技节点在未就绪时引导打开安装向导。
