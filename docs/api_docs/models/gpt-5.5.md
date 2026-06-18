---
title: "GPT-5.5 API"
model_id: "gpt-5.5"
provider: "OpenAI"
type: "chat"
official_url: "https://developers.openai.com/api/docs/models/gpt-5.5"
updated_at: "2026-06-18"
---

# GPT-5.5

OpenAI 最新前沿模型，面向复杂推理、编码、Agent 与长上下文任务。

## 模型标识

| 别名 | Snapshot |
|------|----------|
| `gpt-5.5` | `gpt-5.5-2026-04-23` |

## 端点

推荐使用 **Responses API**：

```
POST https://api.openai.com/v1/responses
```

兼容 Chat Completions：

```
POST https://api.openai.com/v1/chat/completions
```

## 认证

```
Authorization: Bearer $OPENAI_API_KEY
Content-Type: application/json
```

## 基础示例（Responses API）

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5.5",
    "input": "Write a short bedtime story about a unicorn."
  }'
```

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5.5",
    input="Write a short bedtime story about a unicorn.",
)
print(response.output_text)
```

## 主要参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `model` | string | 必填 | `gpt-5.5` |
| `input` | string/array | 必填 | 用户输入或多轮消息 |
| `reasoning.effort` | enum | `medium` | `none`/`low`/`medium`/`high`/`xhigh` |
| `text.verbosity` | enum | `medium` | `low`/`medium`/`high`，控制输出长度 |
| `tools` | array | - | 工具调用（含 `image_generation` 等） |
| `previous_response_id` | string | - | 多轮状态保持 |
| `stream` | boolean | false | 流式输出 |

## 规格

| 项 | 值 |
|----|-----|
| 上下文窗口 | 1,050,000 tokens |
| 最大输出 | 128,000 tokens |
| 知识截止 | 2025-12-01 |
| 输入 | 文本 + 图像 |
| 输出 | 文本 |

## 推理力度建议

| 场景 | `reasoning.effort` |
|------|---------------------|
| 低延迟 / 简单任务 | `low` 或 `none` |
| 通用生产 | `medium`（默认） |
| 复杂 Agent / 编码 | `high` |
| 异步评测 / 极限推理 | `xhigh` |

## 内置工具

- Web Search
- Code Interpreter
- File Search
- Image Generation（调用 GPT Image 模型）
- Computer Use

## 多轮对话

```python
response = client.responses.create(
    model="gpt-5.5",
    input="Generate an image of a cat",
    tools=[{"type": "image_generation"}],
)

followup = client.responses.create(
    model="gpt-5.5",
    previous_response_id=response.id,
    input="Now make it look realistic",
    tools=[{"type": "image_generation"}],
)
```

## 参考链接

- [GPT-5.5 Model](https://developers.openai.com/api/docs/models/gpt-5.5)
- [Using GPT-5.5 Guide](https://developers.openai.com/api/docs/guides/latest-model)
- [Reasoning Models](https://developers.openai.com/api/docs/guides/reasoning)
