# Architecture Notes

> 轻量架构索引，服务高频 AI coding。稳定规则放这里；迭代任务放 `changes/`。

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
| Persistence | Project Bundle（`project.json` + `assets/`）；读写走 `:1421` HTTP | `src/features/project/`, `src/commands/projectState.ts`, `src-tauri/src/project/` |
| Asset System | `assetManifest`、**fileAssetId**、reconcile、资产目录、画布引用 | [`asset-system/README.md`](asset-system/README.md) |
| i18n | 中英文文案 | `src/i18n/` |

## Change Routing

| 变更类型 | 优先查看 |
|----------|----------|
| UI / 交互 | `Canvas.tsx`, `nodes/*.tsx`, `ui/`, `components/ui/primitives.tsx` |
| 新节点 | `canvasNodes.ts`, `nodeRegistry.ts`, `nodes/index.ts` |
| 新工具 | `tools/types.ts`, `builtInTools.ts`, `ui/tool-editors/`, `toolProcessor.ts` |
| 新模型 | `models/image/<provider>/`, `models/providers/`, Rust provider |
| 持久化 | `projectStore.ts`, `features/project/projectCodec.ts`, `projectState.ts`, `file_store.rs` |
| 资产 / 绑定 | [`asset-system/`](asset-system/README.md)、`features/project/asset/` |
| 文案 | `src/i18n/locales/zh.json`, `src/i18n/locales/en.json` |

## Runtime & Channels

本地 Rust HTTP 服务默认 `127.0.0.1:1421`（Tauri 内嵌或 `cargo run --bin video-api`）。

| 能力 | 通道 | 说明 |
|------|------|------|
| 项目 CRUD / 视口 | HTTP `rustApiClient` | Project Bundle 落盘 |
| 资产目录 CRUD / 移动 | HTTP `rustApiClient` | 仅 `assets/` 下 |
| 图片分片上传 / prepare | HTTP | 落盘 + 注册 manifest |
| 分镜合并 / metadata | HTTP | 需 `projectId` |
| 内置 Adapter | HTTP | `/api/v1/adapters/*` |
| 画布 AI 生图 / 部分图片处理 | Tauri `invoke` | 迁移中，见 `roadmap.md` |
| API Key | HTTP + SQLite | `projects.db` |

Web 与 Tauri 共用 React 前端；完整体验需本地 `:1421`。

---

## Asset System

稳定架构与模块拆分见 [`asset-system/README.md`](asset-system/README.md)。

要点：

- **`fileAssetId`** 是 `assets/` 下文件的稳定 id（manifest 键），**不是**画布 `nodeId`。
- 节点通过 `fileAssetId` 引用文件；rename/move 只改 manifest.path。
- 打开项目必须 **reconcile**；展示走 fileAssetId → path → HTTP（`v=updatedAt`）。
- 资产目录 UI 虚拟根为 `assets/`；可预览文件支持双击预览、拖到画布创建 upload 节点。

迭代验收：[`changes/editable-asset-explorer.md`](changes/editable-asset-explorer.md)

---

## Invariants

- 节点注册以 `nodeRegistry.ts` + `canvasNodes.ts` 为单一真相源。
- 项目持久化、上传/prepare、分镜合并、Adapter：**必须**走 `rustApiClient`（HTTP）。
- 本地文件上传：分片二进制 PUT；禁止 JSON base64 整包。
- 拖拽中不重持久化；视口独立轻量通道。
- 每个项目自包含：`project.json` + `assets/`；**文件**以 `fileAssetId` + `assetManifest` 注册；**节点**通过 `fileAssetId` 引用文件。
- 资产 move/rename/delete 只更新 manifest 中**文件 id** 的 path（及磁盘）；禁止只改磁盘不改 manifest。
- 打开项目 **必须** reconcile；旧 `assets/…` path 仅迁移期 fallback。
- 资产管理 UI 虚拟根为 `assets/` 内容；不展示项目外层与 `project.json`。
- 资产 URL 带内容版本（`v=updatedAt`），同路径覆盖可刷新预览。
- `component-doc` 打开重置、不落用户盘改动。
- 新文案同步中英文语言包。

## Project Bundle Layout

磁盘布局见 [`asset-system/data-model.md`](asset-system/data-model.md)。

## Minimal Validation

```bash
npx tsc --noEmit
cd src-tauri && cargo check   # 涉及 Rust 时
npm run build                  # 大改或发布前
```

迭代任务与验收清单：[`changes/editable-asset-explorer.md`](changes/editable-asset-explorer.md)
