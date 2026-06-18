---
name: git-commit-message-guide
description: Use when writing or improving Git commit messages for this project. Provides a lightweight Chinese Conventional Commits style without monorepo scopes, bracketed [scope], or validation steps.
---

# Git Commit Message Guide

用于生成清晰、简洁、可回溯的中文 Git 提交信息。

## Core Rule

每个 commit 只表达一个相对独立的更新点。不同功能、不同模块、无关改动应拆成多个提交。

## Format

```text
<type>：<description>
```

要求：

- `type` 使用中文类型。
- 类型后使用中文冒号 `：`。
- 不使用 monorepo scope。
- 不使用 `[scope]`。
- `description` 使用中文描述，英文专有名词保留原样。

## Types

- `新增`：新增文件、功能、组件、配置、参数、能力。
- `修复`：修复 Bug、异常行为、错误状态。
- `优化`：优化体验、性能、样式、结构或实现细节。
- `更新`：小范围内容更新、依赖更新、配置更新。
- `变更`：更名、目录调整、方案替换、接口变化等较大改动。
- `重构`：不改变外部行为的代码结构调整。
- `删除`：删除文件、功能、代码、配置。
- `恢复`：回滚或恢复旧行为。
- `测试`：测试、调试、临时验证相关改动。
- `发布`：版本发布相关改动。

## Description

描述应说明“改了什么”或“为什么改”，保持短句，不写句号。

推荐：

```text
新增：支持画布节点右键菜单
修复：避免拖拽节点时重复写入项目快照
优化：统一图片节点底部控制条尺寸
更新：补充分镜导出说明文案
```

避免：

```text
更新：更新代码
修复：修复问题
优化：优化了一下。
新增：[canvas] 新增功能
```

## Body

如需补充背景，可在标题后空一行写正文。正文只写必要信息，优先列影响范围和关键原因。

```text
优化：减少画布视口保存频率

将视口持久化改为独立防抖队列，避免缩放和拖拽时触发整项目保存。
```
