---
title: "Nano Banana Pro API"
model_id: "nano-banana-pro / gemini-3-pro-image"
type: "image"
providers: ["google", "fal", "kie", "grsai"]
official_url: "https://ai.google.dev/gemini-api/docs/image-generation"
updated_at: "2026-06-18"
---

# Nano Banana Pro

Google Gemini 3 Pro Image 系列，代号 **Nano Banana Pro**。支持高质量文生图、图编辑、复杂排版与 4K 输出。

## 模型标识

| 平台 | Model ID | 能力 |
|------|----------|------|
| Google 官方 | `gemini-3-pro-image` | 文生图 / 编辑 |
| fal.ai | `fal-ai/nano-banana-pro` | 文生图 |
| fal.ai | `fal-ai/nano-banana-pro/edit` | 图编辑 |
| KIE | `nano-banana-pro` | 文生图 / 图编辑 |
| Grsai | `nano-banana-pro` 等 | 文生图 / 图编辑 |

---

## 1. Google 官方 Gemini API

### 端点

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent
```

### 认证

```
x-goog-api-key: $GEMINI_API_KEY
```

### 文生图示例

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "A studio product photo of a ceramic vase"}]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {
        "aspectRatio": "1:1",
        "imageSize": "2K"
      }
    }
  }'
```

### 主要参数

| 参数 | 说明 |
|------|------|
| `aspectRatio` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `21:9` 等 |
| `imageSize` | `1K`, `2K`, `4K` |
| `thinkingConfig` | Thinking 模式（Pro 系列） |
| 参考图 | 最多 14 张 |

---

## 2. fal.ai

### 文生图

```
POST https://fal.run/fal-ai/nano-banana-pro
```

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/nano-banana-pro", {
  input: {
    prompt: "A studio product photo of a ceramic vase",
    aspect_ratio: "1:1",
    resolution: "2K",
    output_format: "png",
  },
});
```

### 图编辑

```
POST https://fal.run/fal-ai/nano-banana-pro/edit
```

```javascript
const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
  input: {
    prompt: "make the background a sunset beach",
    image_urls: ["https://example.com/input.png"],
  },
});
```

### Input Schema（文生图）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 文本提示词 |
| `num_images` | integer | 1 | 生成数量 |
| `aspect_ratio` | enum | `1:1` | 含 `auto`, `21:9` 等 |
| `resolution` | enum | `1K` | `1K` / `2K` / `4K` |
| `output_format` | enum | `png` | `jpeg` / `png` / `webp` |
| `seed` | integer | - | 随机种子 |
| `enable_web_search` | boolean | false | 联网搜索辅助 |
| `safety_tolerance` | enum | `4` | 1（最严）– 6（最宽），仅 API |

### 队列模式

```javascript
const { request_id } = await fal.queue.submit("fal-ai/nano-banana-pro", {
  input: { prompt: "..." },
  webhookUrl: "https://your-domain.com/webhook",
});
```

认证：`Authorization: Key $FAL_KEY`

---

## 3. KIE

### 端点

```
POST https://api.kie.ai/api/v1/jobs/createTask
```

### 认证

```
Authorization: Bearer $KIE_API_KEY
```

### 示例

```bash
curl --request POST \
  --url https://api.kie.ai/api/v1/jobs/createTask \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "nano-banana-pro",
    "callBackUrl": "https://your-domain.com/api/callback",
    "input": {
      "prompt": "A studio product photo",
      "aspect_ratio": "1:1",
      "resolution": "2K",
      "output_format": "png"
    }
  }'
```

### input 参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 最长 10000 字符 |
| `image_input` | string[] | `[]` | 参考图 URL，最多 8 张，单张 ≤30MB |
| `aspect_ratio` | enum | `1:1` | 含 `auto` |
| `resolution` | enum | `1K` | `1K` / `2K` / `4K` |
| `output_format` | enum | `png` | `png` / `jpg` |

### 任务查询

异步任务，通过 `taskId` 轮询或 `callBackUrl` 回调 → 见 [KIE 任务查询](../providers/kie/task-query.md)。有参考图时见 [KIE 参考图上传](../providers/kie/file-upload.md)。

---

## 4. Grsai

### 端点

```
POST https://grsai.dakka.com.cn/v1/draw/nano-banana   # 国内
POST https://grsaiapi.com/v1/draw/nano-banana         # 海外
```

### 示例

```json
{
  "model": "nano-banana-pro",
  "prompt": "一只可爱的猫咪在草地上玩耍",
  "aspectRatio": "1:1",
  "imageSize": "2K",
  "urls": ["https://example.com/ref.png"],
  "webHook": "-1"
}
```

### 主要 model 值

`nano-banana-pro`、`nano-banana-pro-vt`、`nano-banana-pro-cl`、`nano-banana-pro-vip`、`nano-banana-pro-4k-vip`

详细参数见 [Grsai Nano Banana 接口](../providers/grsai/nano-banana.md)。

---

## 参考链接

- [Google Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [fal Nano Banana Pro T2I](https://fal.ai/models/fal-ai/nano-banana-pro/api)
- [fal Nano Banana Pro Edit](https://fal.ai/models/fal-ai/nano-banana-pro/edit/api)
- [KIE Nano Banana Pro](https://docs.kie.ai/cn/market/google/nano-banana-pro)
