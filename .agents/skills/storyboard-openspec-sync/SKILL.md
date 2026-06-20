---
name: storyboard-openspec-sync
description: Storyboard Copilot 架构与功能变更的双门禁：改代码前评估模块划分/是否需重构，改完后按需同步 OpenSpec。当改动涉及新功能、模块边界、数据模型、HTTP/API、Store、资产/画布/节点/持久化、invariants，或单文件逻辑持续膨胀时触发；要求代码与文档均遵循渐进式披露、单一职责，禁止把过多逻辑堆在同一文件。
---

# 架构与功能变更门禁

本 skill 管两件事：**代码怎么拆**、**文档要不要更**。改架构/功能时**必须先触发**，不能只做实现不同步结构评估。

## 双门禁概览

| 阶段 | 时机 | 读什么 | 产出 |
|------|------|--------|------|
| **A. 结构评估** | 动手写代码**之前** | [code-layout.md](references/code-layout.md)、[refactor-gate.md](references/refactor-gate.md) | 模块划分方案；是否重构及理由 |
| **B. 文档同步** | 实现完成**之后** | [doc-layout.md](references/doc-layout.md)、[sync-checklist.md](references/sync-checklist.md) | 更新 openspec 或说明无需同步 |

小改（单行 bugfix、纯文案）可跳过 A，但仍快速过一遍 B 的第一问。

---

## A. 结构评估（代码渐进式披露）

### 何时必须做 A

- 新增或变更**用户可见能力**
- 动到 **Store / 应用层 / HTTP / 持久化 / 节点注册表**
- 单个目标文件已承担 **2 种以上职责**，或预计本次 diff **> ~80 行**且非纯 UI  markup
- 想在 `Canvas.tsx`、`projectStore.ts`、`AssetExplorerPanel.tsx` 等**枢纽文件**里继续堆业务逻辑

### A 的执行步骤

1. **画数据流**：UI → Store → Application → API/Command → 持久化；新逻辑落在哪一层？
2. **划模块**：一个文件一种主职责；详见 [code-layout.md](references/code-layout.md)。
3. **大改重构判断**：见 [refactor-gate.md](references/refactor-gate.md) 决策树——该拆就拆，该先 refactor 再 feature 的要明说，**禁止**在 god file 上硬叠功能。
4. **默认禁止**
   - UI 组件内直接 `fetch` / `invoke` / 复杂 manifest 编排
   - Store 内写 CRUD、reconcile、拖拽协议等业务
   - 同一文件同时管：HTTP + manifest + 树 UI + 画布 drop
5. 结构方案再写代码；用户只要最小 diff 时，仍须**新逻辑进新模块**，枢纽文件只加薄胶水（import + 调用）。

### 代码单一职责（速查）

| 层级 | 放什么 | 典型位置 |
|------|--------|----------|
| UI | 渲染、事件、本地 UI 状态 | `ui/`、`nodes/` |
| Store | 状态读写、快照、薄转发 | `*Store.ts` |
| Application | 业务编排、协议、工厂 | `application/`、`projectAssetService.ts` |
| Domain | 类型、注册表、纯函数 | `domain/`、`assetManifest.ts` |
| Infrastructure | HTTP 客户端 | `rustApiClient.ts` |
| Rust | 落盘、路由、MIME | `file_store.rs`、`http/mod.rs` |

---

## B. 文档同步（OpenSpec 渐进式披露）

### 何时必须做 B

1. 是否改变**稳定行为**？
2. 是否改变**架构边界**、**数据模型**、**API**、**invariants**？
3. 是否新增/删除**模块入口**或**用户可见能力**？
4. A 阶段是否**新增/拆分**了模块或目录？

任一为「是」→ 同步 openspec；全为「否」→ 通常不动稳定文档。

### B 的执行步骤

```
1. sync-checklist.md → 定位应更新的文件
2. doc-layout.md → 写法符合分层与单一职责
3. 最小 diff 更新文档
4. changes/<slug>.md 已完成则勾选
5. 交付时列出文档变更清单或「无需同步」理由
```

用户未提「同步文档」也**须评估 B**；影响架构时在回复中说明建议更新的路径。

---

## 交付格式（架构/功能改动必填）

1. **结构决策**：新/改模块列表；为何不在枢纽文件堆逻辑；是否 refactor 及范围
2. **文档变更清单**（或「无需同步 stable docs」+ 理由）
3. **验证**：`npx tsc --noEmit` 等（按根 `AGENTS.md`）

## 反模式（代码 + 文档）

**代码**

- 在 `Canvas.tsx` / `AssetExplorerPanel.tsx` 写完整业务链
- 一个 service 文件同时管 clipboard、preview、drag MIME、节点创建
- 为了「少改文件」拒绝抽 `application/` 模块

**文档**

- 把 reconcile、HTTP 表、UI 交互全塞进 `architecture.md`
- 实现已完成仍写「目标架构」将来时
- 无 README 索引的巨型专题 markdown

## 参考文件

- [references/code-layout.md](references/code-layout.md) — 代码分层、拆文件、体量阈值
- [references/refactor-gate.md](references/refactor-gate.md) — 大改是否先重构
- [references/doc-layout.md](references/doc-layout.md) — OpenSpec 分层与专题目录
- [references/sync-checklist.md](references/sync-checklist.md) — 变更类型 → 文档文件
