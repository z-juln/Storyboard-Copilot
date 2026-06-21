# 插件体系

画布能力可通过**插件**扩展。插件在 **项目管理 → 插件列表** 配置；部分插件在画布侧栏提供配套 UI。

## 已规划 / 实现

| 插件 | 说明 | 就绪条件 | 规格 |
|------|------|----------|------|
| 外部科技 · 本地 Z-Image | 本机 Gradio 生图 | 安装 + 服务 + 模型 | [`changes/local-zimage.md`](../changes/local-zimage.md) |
| 版本控制 · Git | 项目 Bundle 版本历史 | 系统已安装 `git` | [`changes/project-git-version-control.md`](../changes/project-git-version-control.md) |

## 共通模式

- **状态检测**：Rust HTTP API 轮询；前端 `use*Status` hook 共享缓存。
- **未就绪 UI**：功能入口（节点 / 侧栏 Tab）展示说明 +「前往插件列表」→ `navigateToProjectHomeTab('plugins')`。
- **卡片 UI**：`CollapsiblePluginCard` + 各插件 `*PluginCard.tsx`。

## 代码入口

| 区域 | 路径 |
|------|------|
| 插件列表页 | `src/features/plugins/PluginListPanel.tsx` |
| 导航 | `src/features/project/projectHomeNavigation.ts` |
| HTTP 插件状态 | `src-tauri/src/http/mod.rs`（`/api/v1/plugins/*` 或插件专属前缀） |
