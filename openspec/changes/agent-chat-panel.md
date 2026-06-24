# Agent 对话面板

## Goal

- 画布工作台提供 Agent 对话 tab + panel
- 默认内置 DeepSeek V4 Flash
- 支持新对话、对话历史、系统提示词展示
- 会话按项目持久化到 `.cache/chat-history/sessions.json`

## Tasks

- [x] 工具栏入口与对话面板 UI
- [x] 内置 DeepSeek 调用（HTTP Adapter）
- [x] 新对话 / 历史下拉 / 系统提示词展示
- [x] 项目级持久化与 localStorage 迁移
- [x] 模块拆分 `agentChat/` + `ui/agent-chat/`

## Acceptance

- [x] 对话历史写入项目 `.cache/chat-history/`，换项目隔离
- [x] 数据流：UI → `agentChat/` → `rustApiClient` → Rust `chat_history_cache.rs`
- [x] `Canvas.tsx` 仅挂载面板，不含业务编排
