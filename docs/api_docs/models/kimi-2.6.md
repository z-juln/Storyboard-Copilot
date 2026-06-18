---
title: "Kimi 2.6 API"
model_id: "kimi-k2.6"
provider: "Moonshot AI"
type: "chat"
official_url: "https://platform.kimi.ai/docs/api/quickstart"
updated_at: "2026-06-18"
---

# Kimi 2.6

Moonshot AI Kimi K2.6，原生多模态架构，支持视觉/文本输入、Thinking/Non-Thinking 模式、Agent 与代码任务。

## 模型标识

| Model ID | 上下文 | 说明 |
|----------|--------|------|
| `kimi-k2.6` | 256K | 最新旗舰，多模态 + Agent |
| `kimi-k2.6-thinking` | 256K | 推理模式 |
| `kimi-k2.5` | 256K | 上一代 |

## 端点

| 区域 | Base URL |
|------|----------|
| 国内 | `https://api.moonshot.cn/v1` |
| 国际 | `https://api.moonshot.ai/v1` |

### Chat Completions

```
POST /v1/chat/completions
```

### 列出模型

```
GET /v1/models
```

## 认证

```
Authorization: Bearer $MOONSHOT_API_KEY
Content-Type: application/json
```

## 基础示例

```bash
curl https://api.moonshot.cn/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -d '{
    "model": "kimi-k2.6",
    "messages": [
      {"role": "user", "content": "Hello, what is 1+1?"}
    ]
  }'
```

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.cn/v1",
)

completion = client.chat.completions.create(
    model="kimi-k2.6",
    messages=[
        {"role": "user", "content": "Hello, what is 1+1?"}
    ],
)
print(completion.choices[0].message.content)
```

```javascript
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.cn/v1",
});

const completion = await client.chat.completions.create({
  model: "kimi-k2.6",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## 主要参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `model` | string | 必填 | `kimi-k2.6` |
| `messages` | array | 必填 | OpenAI 格式消息 |
| `temperature` | float | 1.0 | 官方建议保持默认 |
| `top_p` | float | 1.0 | 官方建议保持默认 |
| `stream` | boolean | false | 流式输出 |
| `tools` | array | - | Function Calling |
| `max_tokens` | integer | - | 最大输出 token |

## 多模态输入

支持图像/视频输入（视觉理解）：

```json
{
  "model": "kimi-k2.6",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Describe this image"},
      {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
    ]
  }]
}
```

## 规格

| 项 | 值 |
|----|-----|
| 上下文 | 262,144 tokens（256K） |
| 最大输出 | 98,304 tokens（推理模式） |
| 协议 | OpenAI Chat Completions 兼容 |
| 流式 | 支持 SSE |

## API Key 获取

1. 注册 [platform.moonshot.cn](https://platform.moonshot.cn) 或 [platform.kimi.ai](https://platform.kimi.ai)
2. 在 API Keys 页面创建密钥
3. 设置环境变量 `MOONSHOT_API_KEY`

## 参考链接

- [Quickstart](https://platform.kimi.ai/docs/api/quickstart)
- [Model List](https://platform.kimi.ai/docs/models)
- [Chat Completions 文档](https://platform.moonshot.cn/docs/api/chat)
