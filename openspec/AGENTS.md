# OpenSpec

本目录只保留 AI coding 需要的轻量上下文，用于文档驱动开发，不做百科式说明。

## 文件

- `project.md`：产品定位与边界
- `architecture.md`：稳定架构、模块入口、约束（索引级，细节拆分子目录）
- `asset-system/`：资产体系专题（术语、数据模型、API、UI、画布绑定）
- `changes/`：每次迭代的短需求、任务、验收

## 使用方式

小改可以只改代码；需要 AI 连续实现或回归时，在 `changes/<slug>.md` 写几行：

```md
# <change name>

## Goal
- ...

## Tasks
- [ ] ...

## Acceptance
- ...
```

实现规范、命令、代码风格仍以仓库根 `AGENTS.md` 为准。

**改架构/功能**：必须先走 `.agents/skills/storyboard-openspec-sync/`（代码模块划分 + 大改 refactor 判断 + openspec 同步）。
