---
title: "Seedream 5.0 API"
model_id: "seedream-5.0-lite / seedream/5-lite-*"
type: "image"
providers: ["ppio", "kie"]
official_url: "https://ppio.com/docs/models/reference-seedream-5.0-lite"
updated_at: "2026-06-18"
---

# Seedream 5.0

字节跳动 Seedream 5.0 系列图像生成模型，支持文生图、图编辑、组图生成。

## 模型标识

| 平台 | Model ID | 能力 |
|------|----------|------|
| PPIO | `seedream-5.0-lite` | 文生图 + 图编辑 + 组图 |
| KIE | `seedream/5-lite-text-to-image` | 文生图 |
| KIE | `seedream/5-lite-image-to-image` | 图生图 |

---

## 1. PPIO

### 端点

```
POST https://api.ppio.com/v3/seedream-5.0-lite
```

### 认证

```
Authorization: Bearer $PPIO_API_KEY
Content-Type: application/json
```

### 文生图示例

```bash
curl --request POST \
  --url https://api.ppio.com/v3/seedream-5.0-lite \
  --header 'Authorization: Bearer <API_KEY>' \
  --header 'Content-Type: application/json' \
  --data '{
    "prompt": "A cozy cafe interior, warm lighting",
    "size": "2048x2048",
    "watermark": false
  }'
```

### 图生图示例

```json
{
  "prompt": "Change the dress material to transparent water",
  "size": "2048x2048",
  "image": ["https://example.com/ref.jpg"],
  "watermark": false
}
```

### 请求体

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 中英文，建议 ≤300 汉字 |
| `size` | string | `2048x2048` | `2K`/`3K` 或像素值如 `2048x2048` |
| `image` | array | - | 参考图 URL/Base64，1–14 张 |
| `watermark` | boolean | `true` | 是否加水印 |
| `optimize_prompt_options.mode` | string | `standard` | 提示词优化 |
| `sequential_image_generation` | string | `disabled` | `auto` 开启组图 / `disabled` 关闭 |
| `sequential_image_generation_options.max_images` | integer | 15 | 组图上限，参考图+生成图 ≤15 |

### 尺寸约束

- 总像素：3,686,400 – 10,404,496
- 宽高比：1/16 – 16
- 参考图格式：jpeg、png、webp、bmp、tiff、gif

### 响应

```json
{ "images": ["https://..."] }
```

---

## 2. KIE

### 端点

```
POST https://api.kie.ai/api/v1/jobs/createTask
```

### 文生图

```bash
curl --request POST \
  --url https://api.kie.ai/api/v1/jobs/createTask \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "seedream/5-lite-text-to-image",
    "input": {
      "prompt": "A cozy cafe interior",
      "aspect_ratio": "16:9",
      "quality": "basic"
    }
  }'
```

### 图生图

```json
{
  "model": "seedream/5-lite-image-to-image",
  "input": {
    "prompt": "Change clothing material to transparent water",
    "image_urls": ["https://example.com/ref.webp"],
    "aspect_ratio": "1:1",
    "quality": "basic"
  }
}
```

### input 参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 最长 3000 字符 |
| `image_urls` | string[] | - | 图生图必填，参考图 URL（jpeg/png/webp，≤10MB） |
| `aspect_ratio` | enum | 必填，`1:1` | `1:1`/`4:3`/`3:4`/`16:9`/`9:16`/`2:3`/`3:2`/`21:9` |
| `quality` | enum | 必填，`basic` | 文生图：`basic`=2K、`high`=3K；图生图：`basic`=2K、`high`=4K |

### 响应

```json
{
  "code": 200,
  "msg": "success",
  "data": { "taskId": "task_seedream_..." }
}
```

任务查询 → [KIE 任务查询](../providers/kie/task-query.md)。有参考图时见 [KIE 参考图上传](../providers/kie/file-upload.md)。

---

## Seedream 4.x

Seedream 4.0 / 4.5 见 [providers/kie/README.md](../providers/kie/README.md) 与 [providers/ppio/README.md](../providers/ppio/README.md)。

## 参考链接

- [PPIO Seedream 5.0 Lite](https://ppio.com/docs/models/reference-seedream-5.0-lite)
- [KIE Seedream 5 Lite T2I](https://docs.kie.ai/cn/market/seedream/5-lite-text-to-image)
- [KIE Seedream 5 Lite I2I](https://docs.kie.ai/cn/market/seedream/5-lite-image-to-image)
