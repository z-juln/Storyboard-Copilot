# Architecture Notes

> 轻量架构索引，服务高频 AI coding。稳定规则放这里；临时需求放 `changes/`。

## Product Shape

Video Copilot 是节点画布工作台：上传素材、AI 生成/编辑、工具处理、分镜与导出都通过节点和连线组织。

核心链路：

```text
Source Node -> Process Node / Tool / AI -> Derived Output Node
```

处理结果默认生成新下游节点，不覆盖原节点。

## Main Modules

| 模块 | 职责 | 代码入口 |
|------|------|----------|
| App Shell | 项目页、画布页、全局对话框 | `src/App.tsx` |
| Project | 项目列表、打开/关闭、自动保存 | `src/stores/projectStore.ts` |
| Canvas | 节点、连线、视口、选择、快捷键 | `src/features/canvas/Canvas.tsx`, `src/stores/canvasStore.ts` |
| Node Domain | 节点类型、默认数据、菜单、连线能力 | `src/features/canvas/domain/` |
| Tools | 裁剪、标注、分镜切割等工具 | `src/features/canvas/tools/`, `toolProcessor.ts` |
| AI Models | 模型定义、供应商、请求映射 | `src/features/canvas/models/`, `src-tauri/src/ai/` |
| Persistence | 项目 Bundle（`projects/<id>/project.json` + `assets/`）；本地/远程图片 URL 引用；读写走 `:1421` HTTP | `src/features/project/`, `src/commands/projectState.ts`, `src-tauri/src/project/`, `src-tauri/src/media/` |
| i18n | 中英文文案 | `src/i18n/` |

## Change Routing

| 变更类型 | 优先查看 |
|----------|----------|
| UI / 交互 | `Canvas.tsx`, `nodes/*.tsx`, `ui/`, `components/ui/primitives.tsx` |
| 新节点 | `canvasNodes.ts`, `nodeRegistry.ts`, `nodes/index.ts` |
| 新工具 | `tools/types.ts`, `builtInTools.ts`, `ui/tool-editors/`, `toolProcessor.ts` |
| 新模型 | `models/image/<provider>/`, `models/providers/`, Rust provider |
| 持久化 | `projectStore.ts`, `features/project/projectCodec.ts`, `projectState.ts`, `src-tauri/src/project/file_store.rs` |
| 文案 | `src/i18n/locales/zh.json`, `src/i18n/locales/en.json` |

## Runtime & Channels

本地 Rust HTTP 服务默认 `127.0.0.1:1421`（Tauri 启动时内嵌拉起，或于 `src-tauri` 执行 `cargo run --bin video-api`）。

| 能力 | 通道 | 说明 |
|------|------|------|
| 项目 CRUD / 视口 | HTTP `rustApiClient` | Project Bundle 落盘 |
| 图片分片上传 / prepare | HTTP | 写入 `projects/<id>/assets/` |
| 分镜合并 / metadata 写入 | HTTP | 需 `projectId` |
| 内置 Adapter 模型 | HTTP | `/api/v1/adapters/*` |
| 画布节点 AI 生图 | Tauri `invoke` | 仍走 bridge，Web 未完整 |
| 图片切割 / 裁剪 / 导出 / 剪贴板 | Tauri `invoke` | 桌面能力，Web 未完整 |
| 供应商 API Key | HTTP + SQLite | 存 `{app_data}/projects.db` |
| 窗口 / 更新检查 | Tauri `invoke` | 仅桌面壳 |

Web 与 Tauri 共用同一套 React 前端；完整体验需本地 `:1421` API，部分桌面能力仍需 Tauri。

## Invariants

- 节点注册以 `domain/nodeRegistry.ts` 和 `domain/canvasNodes.ts` 为单一真相源。
- UI 不直接调用外部 AI/API；通过应用层、命令层或本地 `:1421` HTTP 服务中转。
- 项目持久化、图片上传/prepare、分镜合并/embed 与内置 Adapter：**必须**走 `rustApiClient`（HTTP），不走 WebView `invoke`。
- 画布 AI 生图与部分图片处理（切割、裁剪、导出、剪贴板）**当前仍走** Tauri `invoke`，迁移中见 `roadmap.md`。
- 本地文件上传走分片二进制 PUT（默认 4MB/片），禁止 JSON base64 整包上传；data URL 同样先转 Blob 再分片。
- 工具产物走“生成新节点”链路。
- 拖拽中不做重持久化；结束后防抖保存。
- 视口保存走独立轻量通道。
- 每个项目自包含：`projects/<project-id>/project.json` + `assets/`；JSON 内图片用 `assets/...` 相对路径或 `https://` URL。
- 开发内置 `component-doc` 与正式项目同结构（源码在 `src/features/canvas/component-doc/`，打开时重置、不落用户盘改动）。
- 新文案必须同时更新中英文语言包。

## Project Bundle Layout

```text
{app_data}/projects/{project-id}/
├── project.json    # nodes / edges / viewport / history（可读 JSON）
└── assets/         # 本项目专属图片等资源
```

`component-doc`（仅 dev）：

```text
src/features/canvas/component-doc/
├── project.json
└── assets/
```

## Minimal Validation

默认先跑：

```bash
npx tsc --noEmit
```

涉及 Rust/Tauri 时再跑：

```bash
cd src-tauri && cargo check
```

大改或发布前跑：

```bash
npm run build
```
