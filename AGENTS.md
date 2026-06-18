# AGENTS.md

面向 AI coding 的工程约束。产品/架构轻量说明见 `openspec/`。

## 项目概况

- 产品：节点画布工作台，支持图片上传、AI 生成/编辑、裁剪/标注/分镜、导出。
- 前端：React + TypeScript + Zustand + @xyflow/react + TailwindCSS。
- 后端：Tauri 2 + Rust + SQLite（rusqlite，WAL）。
- 原则：解耦、可扩展、可回归验证、自动持久化、交互性能优先。

## 优先阅读

- 入口与状态：`src/App.tsx`, `src/stores/projectStore.ts`, `src/stores/canvasStore.ts`
- 画布：`src/features/canvas/Canvas.tsx`, `src/features/canvas/domain/`
- 节点：`src/features/canvas/nodes/`, `src/features/canvas/ui/`
- 工具：`src/features/canvas/tools/`, `src/features/canvas/application/toolProcessor.ts`
- 模型：`src/features/canvas/models/`, `src-tauri/src/ai/`
- 持久化：`src/commands/projectState.ts`, `src-tauri/src/commands/project_state.rs`

## 改动路由

| 变更 | 主要位置 |
|------|----------|
| UI/交互 | `Canvas.tsx`, `nodes/*.tsx`, `ui/`, `components/ui/primitives.tsx` |
| 新节点 | `canvasNodes.ts`, `nodeRegistry.ts`, `nodes/index.ts` |
| 新工具 | `tools/types.ts`, `builtInTools.ts`, `tool-editors/`, `toolProcessor.ts` |
| 新模型/供应商 | `models/image/<provider>/`, `models/providers/`, `src-tauri/src/ai/providers/` |
| 持久化 | `projectStore.ts`, `projectState.ts`, `project_state.rs` |
| 文案 | `src/i18n/locales/zh.json`, `src/i18n/locales/en.json` |

## 硬约束

- 沿数据流改动：UI -> Store -> 应用服务 -> 命令/API -> 持久化。
- UI 不直接耦合 Tauri/API/外部网络；通过应用层或命令层中转。
- Store 不承载重业务逻辑；业务逻辑放应用层。
- 节点类型、默认数据、菜单和连线能力以 `domain/nodeRegistry.ts` + `domain/canvasNodes.ts` 为单一真相源。
- 菜单候选节点由注册表函数推导，禁止在 UI 层手写类型白名单。
- 工具和 AI 处理结果默认生成新下游节点，不覆盖源节点。
- 节点底部控制条复用 `nodeControlStyles.ts`，节点工具条复用 `nodeToolbarConfig.ts`。
- 复用 `src/components/ui/primitives.tsx` 和 `index.css` token，避免散落硬编码样式。
- 快捷键避开 `input/textarea/contentEditable`。

## 性能与持久化

- 拖拽中不写盘，不做重计算；拖拽结束后保存。
- 项目快照使用防抖 + idle 调度。
- 视口保存走独立轻量通道 `update_project_viewport_record`，不要回退到整项目 upsert。
- 大图渲染优先用 `previewImageUrl`，模型/工具处理使用原图 `imageUrl`。
- 新增图片字段需同步 `imagePool + __img_ref__` 编码/解码。
- SQLite 表结构变化必须在 `ensure_projects_table` 中做自愈迁移。

## i18n

- 组件文案使用 `useTranslation()` + `t('key.path')`。
- 新 key 同步写入 `src/i18n/locales/zh.json` 和 `src/i18n/locales/en.json`。
- key 稳定、模块化，避免把中文句子当 key。
- 切换中英文后，不应出现 key 泄露或按钮文案截断。

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
- `openspec/`：产品定位、轻量架构、迭代需求与验收。
- `docs/`：用户向或专题说明、API 参考、发布说明。

只有新增稳定约束或架构边界变化时才更新本文档；临时交互细节放到 `openspec/changes/`。
