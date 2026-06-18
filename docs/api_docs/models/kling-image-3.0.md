---
title: "Kling Image 3.0 API"
model_id: "klingai:kling-image@3"
provider: "Kling AI (via Runware / 官方)"
type: "image"
official_url: "https://runware.ai/docs/models/klingai-image-3-0"
updated_at: "2026-06-18"
---

# Kling Image 3.0

快手可灵 IMAGE 3.0 图像生成模型，原生 2K–4K 分辨率，支持文生图、图生图、编辑。

## 模型标识

| 平台 | Model ID |
|------|----------|
| Runware | `klingai:kling-image@3` |
| 官方 | `kling-v3-image`（见官方文档） |

## 能力

- Text to Image
- Image to Image（参考图）
- Edit
- 分辨率：1K / 2K 预设

---

## 1. Runware 网关

### 端点

```
POST https://api.runware.ai/v1
```

### 认证

```
Authorization: Bearer $RUNWARE_API_KEY
```

### 文生图示例

```json
{
  "taskType": "imageInference",
  "taskUUID": "b47f79d6-af49-4208-8995-63d507de6a05",
  "model": "klingai:kling-image@3",
  "positivePrompt": "A narrow cobalt-painted alley after rain, cinematic lighting",
  "width": 2496,
  "height": 1664,
  "deliveryMethod": "sync"
}
```

### 图生图示例

```json
{
  "taskType": "imageInference",
  "taskUUID": "e93e9c10-ac72-41e8-8dd4-424cbb4c6745",
  "model": "klingai:kling-image@3",
  "positivePrompt": "Transform into a regal swan knight in velvet armor",
  "width": 1664,
  "height": 2496,
  "inputs": {
    "referenceImages": ["https://example.com/reference.jpg"]
  }
}
```

### 主要参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskType` | string | 是 | `imageInference` |
| `taskUUID` | string | 是 | UUID v4 |
| `model` | string | 是 | `klingai:kling-image@3` |
| `positivePrompt` | string | 是 | 最长 2500 字符 |
| `width` / `height` | integer | 是* | 像素尺寸（成对） |
| `resolution` | enum | - | `1k` / `2k`（需配合 referenceImages） |
| `inputs.referenceImages` | string[] | - | 参考图 URL/Base64 |
| `numberResults` | integer | - | 1–20，默认 1 |
| `outputType` | string | - | `URL` / `base64Data` / `dataURI` |
| `outputFormat` | string | - | `JPG` / `PNG` / `WEBP` |
| `deliveryMethod` | string | - | `sync` / `async` |

*使用 `resolution` 时需提供 `referenceImages`，且不可与 `width/height` 同时使用。

### 支持尺寸（部分）

| 配置 | 尺寸 |
|------|------|
| 1K (1:1) | 1024×1024 |
| 1K (16:9) | 1360×768 |
| 2K (1:1) | 2048×2048 |
| 2K (16:9) | 2720×1536 |
| 2K (21:9) | 3104×1312 |

### 响应

```json
{
  "taskType": "imageInference",
  "taskUUID": "...",
  "imageUUID": "...",
  "imageURL": "https://...",
  "seed": 1388192264,
  "cost": 0.028
}
```

---

## 2. Kling 官方 API

### 基础信息

- 文档：[app.klingai.com/global/dev](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview)
- Base URL：`https://api.klingai.com`
- 认证：JWT（AccessKey + SecretKey 生成）

### 图片生成端点

```
POST /v1/images/generations
```

> 旧版 `model` 字段已改为 `model_name`，建议使用 `model_name` 指定版本。

### 调用模式

异步任务：提交 → 获取 `task_id` → 轮询 → 下载结果。

### 主要参数

| 参数 | 说明 |
|------|------|
| `model_name` | 模型版本，如 `kling-v3` |
| `prompt` | 文本提示词 |
| `negative_prompt` | 负向提示 |
| `aspect_ratio` | 含 21:9 |
| `image` | 参考图（Base64 或 URL） |
| `image_reference` | 角色特征/外观参考 |

---

## 参考链接

- [Runware Kling IMAGE 3.0](https://runware.ai/docs/models/klingai-image-3-0)
- [Kling 官方开发者文档](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview)
