# Architecture Notes

> 轻量架构索引，服务高频 AI coding。稳定规则放这里；临时需求放 `changes/`。

## Product Shape

Storyboard Copilot 是节点画布工作台：上传素材、AI 生成/编辑、工具处理、分镜与导出都通过节点和连线组织。

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
| Persistence | SQLite 项目快照、视口、图片池；本地图片读写走 `:1421` HTTP | `src/commands/projectState.ts`, `src/infrastructure/rustApiClient.ts`, `src-tauri/src/project/`, `src-tauri/src/media/` |
| i18n | 中英文文案 | `src/i18n/` |

## Change Routing

| 变更类型 | 优先查看 |
|----------|----------|
| UI / 交互 | `Canvas.tsx`, `nodes/*.tsx`, `ui/`, `components/ui/primitives.tsx` |
| 新节点 | `canvasNodes.ts`, `nodeRegistry.ts`, `nodes/index.ts` |
| 新工具 | `tools/types.ts`, `builtInTools.ts`, `ui/tool-editors/`, `toolProcessor.ts` |
| 新模型 | `models/image/<provider>/`, `models/providers/`, Rust provider |
| 持久化 | `projectStore.ts`, `projectState.ts`, `project_state.rs` |
| 文案 | `src/i18n/locales/zh.json`, `src/i18n/locales/en.json` |

## Invariants

- 节点注册以 `domain/nodeRegistry.ts` 和 `domain/canvasNodes.ts` 为单一真相源。
- UI 不直接调用外部 AI/API；通过应用层、命令层或本地 `:1421` HTTP 服务中转。
- Web 与 Tauri WebView 共用同一套 `rustApiClient`；图片落盘与读取不走 WebView `invoke`。
- 本地文件上传走分片二进制 PUT（默认 4MB/片），禁止 JSON base64 整包上传；data URL 同样先转 Blob 再分片。
- 工具产物走“生成新节点”链路。
- 拖拽中不做重持久化；结束后防抖保存。
- 视口保存走独立轻量通道。
- 新图片字段如果持久化，必须同步 `imagePool` 编码/解码。
- 新文案必须同时更新中英文语言包。

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
