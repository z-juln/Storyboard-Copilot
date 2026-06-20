# Video Copilot

## 是什么

面向分镜与视觉预演的节点画布工作台：上传素材、AI 出图、裁剪标注、分镜切割/生成、导出，都通过节点和连线组织。项目自动保存，重启可恢复。

## 文档

- `architecture.md`：AI coding 前优先读
- `changes/`：迭代需求和验收
- 根目录 `AGENTS.md`：工程规范和验证命令

## 非目标

- 多人协作、云端同步
- 视频时间轴剪辑
- **无本地 Rust 服务**时的 AI / 持久化 / 文件能力（纯静态托管不可用）
- 用 WebView bridge（invoke）作为 AI 与模型调用的主通道

## 产品形态（目标）

- **Web 端 + 本地 Rust HTTP API = 完整应用**（与 Tauri 窗口共用同一前端、同一 `:1421` API）
- Tauri 桌面壳：窗口与系统集成；业务 API 逐步全部走本地网络请求，不走 bridge
