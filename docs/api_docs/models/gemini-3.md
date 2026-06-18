---
title: "Gemini 3 API"
model_id: "gemini-3-*"
type: "multimodal"
providers: ["google", "ppio"]
official_url: "https://ai.google.dev/gemini-api/docs"
updated_at: "2026-06-18"
---

# Gemini 3

Google Gemini 3 系列，涵盖文本、图像、视频、音频多模态能力。图像生成子系列代号 **Nano Banana**（详见 [nano-banana-pro.md](./nano-banana-pro.md)、[nano-banana-2.md](./nano-banana-2.md)）。

## 模型标识

### 文本 / 多模态对话

| Model ID | 说明 | 状态 |
|----------|------|------|
| `gemini-3.5-flash` | 高性能 Agent/Coding | Stable |
| `gemini-3-flash` | 高性价比 | Stable |
| `gemini-3.1-pro` | 高级推理 | Preview |
| `gemini-3.1-flash` | 快速多模态 | Stable |

### 图像生成（Nano Banana）

| 代号 | Model ID | 文档 |
|------|----------|------|
| Nano Banana Pro | `gemini-3-pro-image` | [nano-banana-pro.md](./nano-banana-pro.md) |
| Nano Banana 2 | `gemini-3.1-flash-image` | [nano-banana-2.md](./nano-banana-2.md) |
| Nano Banana | `gemini-2.5-flash-image` | — |

---

## 1. Google 官方 — 文本生成

### 端点

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

### 认证

```
x-goog-api-key: $GEMINI_API_KEY
```

### 示例

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Explain how AI works in a few words"}]
    }]
  }'
```

### 主要配置

| 参数 | 说明 |
|------|------|
| `systemInstruction` | 系统指令 |
| `maxOutputTokens` | 最大输出 token |
| `thinkingConfig` | Thinking 模式 |
| `tools` | Google Search、Code Execution 等 |

> Gemini 3.x 不建议修改 `temperature`/`top_p`/`top_k` 默认值。

---

## 2. Google 官方 — 图像生成

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent
```

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3.1-flash-image",
    contents="Create a picture of a cat",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="2K"),
    ),
)
```

Gemini 3 图像特性：Thinking 构图、Google Search Grounding、最多 14 张参考图、多轮 Chat 编辑。

---

## 3. PPIO 网关（项目已接入 Gemini 3.1 Flash）

### 文生图

```
POST https://api.ppio.com/v3/gemini-3.1-flash-image-text-to-image
```

```bash
curl --request POST \
  --url https://api.ppio.com/v3/gemini-3.1-flash-image-text-to-image \
  --header 'Authorization: Bearer <API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "prompt": "A studio product photo",
    "size": "2K",
    "aspect_ratio": "1:1",
    "output_format": "image/png"
  }'
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `prompt` | 必填 | 文本提示词 |
| `size` | `1K` | `0.5K`/`1K`/`2K`/`4K` |
| `aspect_ratio` | `1:1` | 含 `1:4`, `4:1`, `1:8`, `8:1`, `21:9` 等 |
| `output_format` | `image/png` | `image/png`/`image/jpeg` |

响应：`{ "image_urls": ["..."] }`

### 图片编辑

```
POST https://api.ppio.com/v3/gemini-3.1-flash-image-edit
```

| 参数 | 说明 |
|------|------|
| `prompt` | 编辑描述 |
| `image_urls` | 输入图 URL，最多 14 张 |
| `image_base64s` | Base64 输入，与 URL 合计 ≤14 |
| `size` | `0.5K`–`4K` |
| `aspect_ratio` | 输出宽高比 |

---

## SDK

| 语言 | 包 |
|------|-----|
| Python | `google-genai` |
| JavaScript | `@google/genai` |
| REST | 直接 HTTP |

## 参考链接

- [Gemini API 概览](https://ai.google.dev/gemini-api/docs)
- [Text Generation](https://ai.google.dev/gemini-api/docs/text-generation)
- [Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [PPIO Gemini 3.1 Flash T2I](https://ppio.com/docs/models/reference-gemini-3.1-flash-image-text-to-image)
- [PPIO Gemini 3.1 Flash Edit](https://ppio.com/docs/models/reference-gemini-3.1-flash-image-edit)
