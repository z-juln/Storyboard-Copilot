---
title: "DeepSeek V4 Pro API"
model_id: "deepseek-v4-pro"
provider: "DeepSeek"
type: "chat"
official_url: "https://api-docs.deepseek.com/"
updated_at: "2026-06-18"
---

# DeepSeek V4 Pro

DeepSeek V4 系列旗舰模型，1.6T 总参数 / 49B 激活，100 万 token 上下文，支持 Thinking / Non-Thinking 双模式。

## 模型标识

| Model ID | 参数 | 上下文 | 说明 |
|----------|------|--------|------|
| `deepseek-v4-pro` | 1.6T / 49B | 1M | 旗舰，Agent/Coding 最强 |
| `deepseek-v4-flash` | 284B / 13B | 1M | 默认高性价比 |
| `deepseek-chat` | → v4-flash | 1M | **2026-07-24 退役** |
| `deepseek-reasoner` | → v4-flash thinking | 1M | **2026-07-24 退役** |

## 端点

| 协议 | Base URL |
|------|----------|
| OpenAI 兼容 | `https://api.deepseek.com` |
| Anthropic 兼容 | `https://api.deepseek.com/anthropic` |

### Chat Completions

```
POST https://api.deepseek.com/chat/completions
```

## 认证

```
Authorization: Bearer $DEEPSEEK_API_KEY
Content-Type: application/json
```

## 基础示例

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
  -d '{
    "model": "deepseek-v4-pro",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "thinking": {"type": "enabled"},
    "reasoning_effort": "high",
    "stream": false
  }'
```

```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_DEEPSEEK_API_KEY",
    base_url="https://api.deepseek.com",
)

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": "Hello!"}],
    extra_body={"thinking": {"type": "enabled"}},
    reasoning_effort="high",
)
print(response.choices[0].message.content)
```

## Thinking 模式

| 参数 | 格式 | 说明 |
|------|------|------|
| `thinking.type` | `enabled` / `disabled` | 开关推理链 |
| `reasoning_effort` | `high` / `max` | 推理深度 |

- 推理内容通过 `reasoning_content` 字段返回
- 多轮对话需完整回传 `reasoning_content`
- 支持 Tool Calling + Thinking 组合

## 主要特性

- OpenAI / Anthropic SDK 兼容
- 1M token 上下文
- JSON Mode、Streaming、Function Calling
- FIM Completion（Beta，仅 non-thinking）
- Prompt Caching
- Agent 工具集成（Claude Code、Copilot 等）

## 迁移说明

从旧版迁移只需改 `model` 为 `deepseek-v4-pro` 或 `deepseek-v4-flash`，`base_url` 不变。

## 参考链接

- [Your First API Call](https://api-docs.deepseek.com/)
- [V4 Preview Release](https://api-docs.deepseek.com/news/news260424)
- [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
