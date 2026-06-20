# AGENTS.md

面向 AI coding 的工程约束。产品/架构轻量说明见 `openspec/`。

## 项目概况

- 产品：节点画布工作台，支持图片上传、AI 生成/编辑、裁剪/标注/分镜、导出。
- 前端：React + TypeScript + Zustand + @xyflow/react + TailwindCSS。
- 后端：Tauri 2 + Rust；本地 HTTP API（`:1421`）承载项目 Bundle、图片上传与 Adapter 调用；SQLite（`projects.db`）仅存供应商 API Key
- 原则：解耦、可扩展、可回归验证、自动持久化、交互性能优先。

## 优先阅读

- 入口与状态：`src/App.tsx`, `src/stores/projectStore.ts`, `src/stores/canvasStore.ts`
- 画布：`src/features/canvas/Canvas.tsx`, `src/features/canvas/domain/`
- 节点：`src/features/canvas/nodes/`, `src/features/canvas/ui/`
- 工具：`src/features/canvas/tools/`, `src/features/canvas/application/toolProcessor.ts`
- 模型：`src/features/canvas/models/`, `src-tauri/src/ai/`
- 持久化：`src/features/project/`, `src/commands/projectState.ts`, `src-tauri/src/project/file_store.rs`
- 资产体系：`src/features/project/asset/`；架构说明 `openspec/asset-system/README.md`

## 改动路由

| 变更 | 主要位置 |
|------|----------|
| UI/交互 | `Canvas.tsx`, `nodes/*.tsx`, `ui/`, `components/ui/primitives.tsx` |
| 新节点 | `canvasNodes.ts`, `nodeRegistry.ts`, `nodes/index.ts` |
| 新工具 | `tools/types.ts`, `builtInTools.ts`, `tool-editors/`, `toolProcessor.ts` |
| 新模型/供应商 | `models/image/<provider>/`, `models/providers/`, `src-tauri/src/ai/providers/` |
| 持久化 | `projectStore.ts`, `features/project/`, `projectState.ts`, `file_store.rs` |
| 资产 / 绑定 | `features/project/asset/`、`openspec/asset-system/` |

## 硬约束

- 沿数据流改动：UI -> Store -> 应用服务 -> 命令/API -> 持久化。
- UI 不直接耦合 Tauri/API/外部网络；通过应用层或命令层中转。
- Store 不承载重业务逻辑；业务逻辑放应用层。
- **单一职责 / 渐进式披露（代码）**：不把多条业务链堆在同一文件；UI/Store 枢纽只加胶水。新能力先进 `application/` 或领域 service；大改前先过 refactor 判断。详见 `.agents/skills/storyboard-openspec-sync/`。
- 节点类型、默认数据、菜单和连线能力以 `domain/nodeRegistry.ts` + `domain/canvasNodes.ts` 为单一真相源。
- 菜单候选节点由注册表函数推导，禁止在 UI 层手写类型白名单。
- 工具和 AI 处理结果默认生成新下游节点，不覆盖源节点。
- 节点底部控制条复用 `nodeControlStyles.ts`，节点工具条复用 `nodeToolbarConfig.ts`。
- 复用 `src/components/ui/primitives.tsx` 和 `index.css` token，避免散落硬编码样式。
- 快捷键避开 `input/textarea/contentEditable`。

## 性能与持久化

- 拖拽中不写盘，不做重计算；拖拽结束后保存。
- 项目快照使用防抖 + idle 调度。
- 视口保存走独立轻量 HTTP 通道 `PUT /api/v1/projects/:id/viewport`，不要回退到整项目 upsert。
- 大图渲染走 `/assets/preview`（`.cache/previews/{contentHash}_{max}.png`）；AI/工具用原图。展示：**fileAssetId → assetManifest.path → HTTP**（`v=updatedAt`）；迁移期可读 `imageUrl` path 缓存。节点不持久化 preview 字段。
- **`fileAssetId` 是 `assets/` 下文件的稳定 id（manifest 键），不是画布 nodeId。**
- 节点通过 `fileAssetId` **引用**文件；manifest 存 id→path。打开项目必须 reconcile；upload 落盘 register 新 fileAssetId。
- 文件 move/rename 只改 manifest 中该 fileAssetId 的 path；禁止只改磁盘不改 manifest。

## 验证

默认快速检查：

```bash
npx tsc --noEmit
```

涉及 Rust/Tauri：

```bash
cd src-tauri && cargo check
```

影响打包、依赖、入口、持久化、Tauri 命令，或大改收尾：

```bash
npm run build
```

## 发布口令

当用户明确说“推送更新”时，默认执行补丁版本发布：

1. 基于上一个 release/tag 自动递增 patch 版本号。
2. 汇总代码变动生成 `docs/releases/vx.y.z.md`。
3. 同步版本，创建发布提交、annotated tag，并推送远端。

如果用户指定 minor/major 或自定义说明，按用户要求覆盖默认行为。

发布说明只保留 `## 新增`、`## 优化`、`## 修复` 等二级标题和列表项；空分组可省略，不写总标题、范围说明或完整提交清单。

## 文档边界

- 根 `AGENTS.md`：稳定工程规则、验证、发布约定。
- `openspec/`：产品定位、轻量架构、迭代需求与验收；专题见 `openspec/asset-system/` 等子目录。
- `docs/`：用户向或专题说明、API 参考、发布说明。
- 改架构/功能时：**代码结构评估 + 文档是否同步**，见 `.agents/skills/storyboard-openspec-sync/SKILL.md`（双门禁：先划模块/判断是否重构，再同步 openspec）。

只有新增稳定约束或架构边界变化时才更新本文档；临时交互细节放到 `openspec/changes/`。
