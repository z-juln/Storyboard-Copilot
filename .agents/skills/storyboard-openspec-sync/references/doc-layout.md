# OpenSpec 文档布局规范

与代码同一原则：**渐进式披露、单一职责、枢纽文件只做索引**。

## 渐进式披露

1. **第一层**：根 `AGENTS.md`、`openspec/architecture.md` — 索引与 invariants。
2. **第二层**：`openspec/<topic>/README.md` — 专题入口、状态表、链接。
3. **第三层**：专题子文件 — 术语、数据模型、API、UI 等**单一职责**。
4. **第四层**：`openspec/changes/` — 单次迭代；稳定内容迁入第二/三层。

阅读顺序：索引 → README → 按需子文件。代码模块划分见 [code-layout.md](code-layout.md)。

## 单一职责（按内容类型选文件）

| 内容类型 | 放置位置 | 示例 |
|----------|----------|------|
| 术语定义 | `<topic>/terminology.md` | fileAssetId vs nodeId |
| 持久化 / schema | `<topic>/data-model.md` | manifest、project.json |
| 流程 / 生命周期 | `<topic>/lifecycle.md` | reconcile |
| HTTP / Rust API | `<topic>/http-api.md` | 方法、路径 |
| 前端模块表 | `<topic>/frontend-modules.md` | 文件职责、数据流 |
| UI 交互 | `<topic>/explorer-ui.md` | 快捷键、DnD |
| 跨模块集成 | `<topic>/canvas-binding.md` | 画布拖放 |

新专题仿 `openspec/asset-system/`；代码侧新增子目录时，在 `frontend-modules.md` 或 architecture **一行**索引中可发现。

## 文件体量

- `architecture.md`：专题 **≤ 15 行摘要 + 链接**。
- 子文件：**< ~120 行**；超出则拆。
- 用路径索引代码，不全文贴实现。

## 用语与边界

- 已实现用**现在时**；待办在 `changes/` 或 README 状态表。
- 与根 `AGENTS.md` invariants 一致。
- 根 `AGENTS.md` 只收**长期硬约束**；专题细节不进根 AGENTS。
- 用户向内容 → `docs/`；AI 架构上下文 → `openspec/`。

## 链接约定

- 专题内：`[terminology.md](terminology.md)`
- 跨目录：`[asset-system/README.md](../asset-system/README.md)`
