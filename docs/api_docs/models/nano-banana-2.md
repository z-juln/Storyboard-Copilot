---
title: "Nano Banana 2 API"
model_id: "nano-banana-2 / gemini-3.1-flash-image"
type: "image"
providers: ["google", "fal", "kie", "grsai"]
official_url: "https://ai.google.dev/gemini-api/docs/image-generation"
updated_at: "2026-06-18"
---

# Nano Banana 2

Google Gemini 3.1 Flash Image 系列，代号 **Nano Banana 2**。相比 Pro 更快、成本更低，适合高吞吐场景。

## 模型标识

| 平台 | Model ID | 能力 |
|------|----------|------|
| Google 官方 | `gemini-3.1-flash-image` | 文生图 / 编辑 |
| fal.ai | `fal-ai/nano-banana-2` | 文生图 |
| fal.ai | `fal-ai/nano-banana-2/edit` | 图编辑 |
| KIE | `nano-banana-2` | 文生图 / 图编辑 |
| Grsai | `nano-banana-2` | 文生图 / 图编辑 |

---

## 1. Google 官方 Gemini API

### 端点

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent
```

### 示例

```python
from google import genai
from google.genai import types

client = genai.Client()
response = client.models.generate_content(
    model="gemini-3.1-flash-image",
    contents="Create a picture of a cat eating a nano-banana",
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="1:1", image_size="2K"),
    ),
)
```

---

## 2. fal.ai

### 文生图

```
POST https://fal.run/fal-ai/nano-banana-2
```

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/nano-banana-2", {
  input: {
    prompt: "An action shot of a black lab swimming in a pool",
    aspect_ratio: "16:9",
    resolution: "2K",
  },
});
```

### 图编辑

```
POST https://fal.run/fal-ai/nano-banana-2/edit
```

参数与 Pro 版类似：`prompt` + `image_urls`。

认证：`Authorization: Key $FAL_KEY`

---

## 3. KIE

### 端点

```
POST https://api.kie.ai/api/v1/jobs/createTask
```

### 示例

```bash
curl --request POST \
  --url https://api.kie.ai/api/v1/jobs/createTask \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "nano-banana-2",
    "input": {
      "prompt": "一幅高度细致的插画，4K 质量",
      "aspect_ratio": "auto",
      "resolution": "2K",
      "output_format": "jpg",
      "google_search": false,
      "image_input": []
    }
  }'
```

### input 参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 文本提示词 |
| `image_input` | string[] | `[]` | 参考图 URL，最多 14 张 |
| `aspect_ratio` | enum | `auto` | 含 `1:1`, `16:9` 等 |
| `resolution` | enum | `2K` | `1K` / `2K` / `4K` |
| `output_format` | enum | `jpg` | `png` / `jpg` |
| `google_search` | boolean | false | 联网搜索 |

任务查询 → [KIE 任务查询](../providers/kie/task-query.md)。有参考图时见 [KIE 参考图上传](../providers/kie/file-upload.md)。

---

## 4. Grsai

在 `/v1/draw/nano-banana` 接口中将 `model` 设为 `nano-banana-2`。详见 [Grsai Nano Banana 接口](../providers/grsai/nano-banana.md)。

---

## 参考链接

- [Google Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [fal Nano Banana 2](https://fal.ai/models/fal-ai/nano-banana-2/api)
- [KIE Nano Banana 2](https://docs.kie.ai/cn/market/google/nano-banana-2)
