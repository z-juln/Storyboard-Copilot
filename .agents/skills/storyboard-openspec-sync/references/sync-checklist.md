# 变更类型 → 同步清单

实现完成后勾选；**结构评估（A）与文档同步（B）分开勾**。

## A. 代码结构（动手前 / 交付时）

| 变更 | 动作 |
|------|------|
| 新用户可见能力 | 过 [refactor-gate.md](refactor-gate.md)；新逻辑进 application/service |
| 动枢纽文件 | 确认仅胶水代码；业务已抽模块 |
| 新子目录 / 3+ 相关文件 | 仿 `asset/` 分层；`index.ts` 导出 |
| 复制 manifest/path 逻辑 | 收到 domain/application，不留在 UI |
| 单文件职责混杂 | 先拆再 feature，或交付注明 tech debt |

## B. 文档同步（完成后）

### 通用

| 变更 | 更新文件 |
|------|----------|
| 新模块 / 职责迁移 | `architecture.md` Main Modules + Change Routing |
| 新 application 模块（稳定能力） | 专题 `frontend-modules.md` 或 architecture 一行 |
| 新 invariant / 验证命令 | 根 `AGENTS.md` |
| 迭代完成 | `changes/<slug>.md` 勾选 |
| 新专题 | `openspec/<topic>/README.md` + 子文件 |

### 资产体系（`openspec/asset-system/`）

| 变更 | 更新文件 |
|------|----------|
| 术语、manifest 字段 | `terminology.md`、`data-model.md` |
| reconcile | `lifecycle.md` |
| HTTP | `http-api.md` |
| 新 TS 模块 | `frontend-modules.md` |
| Explorer UI | `explorer-ui.md` |
| 画布绑定 | `canvas-binding.md` |
| 实现状态 | `README.md` 状态表 |

### 其他域

| 变更 | 更新文件 |
|------|----------|
| 新节点类型 | `architecture.md` Change Routing；`changes/` |
| project.json 字段 | 对应专题 `data-model.md` |
| 新 HTTP 项目接口 | `architecture.md` Runtime + 专题 `http-api.md` |
| AI 供应商/模型 | 专用 skill / `docs/development-guides/` |

### 通常不改 openspec

- 纯样式、同职责文件内 bugfix
- 仅 refactor 且**无**对外行为与模块边界变化（但交付仍说明结构决策）

## 决策树（B）

```text
稳定行为或模块边界变了吗？
├─ 否 → 不写 stable docs
└─ 是 → 已有专题？
         ├─ 是 → 更新子文件 + README
         └─ 否 → architecture 索引 + 新建专题或 changes/
```

## 完成自检

**代码**

- [ ] 枢纽文件未堆长业务链
- [ ] 新逻辑位置与 [code-layout.md](code-layout.md) 一致
- [ ] 大改已过 refactor-gate

**文档**

- [ ] architecture 与专题无重复长文
- [ ] README 索引含新文件/模块
- [ ] 时态与实现一致
