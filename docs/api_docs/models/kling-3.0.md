---
title: "Kling 3.0 API"
model_id: "kling-video/v3"
provider: "Kling AI (via fal / 官方 / Runware)"
type: "video"
official_url: "https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview"
updated_at: "2026-06-18"
---

# Kling 3.0

快手可灵 Kling VIDEO 3.0，统一多模态模型，支持文生视频、图生视频、元素一致性、原生音频、多分镜叙事，最长 15 秒。

## 模型标识

| 平台 | Model ID | 说明 |
|------|----------|------|
| fal.ai | `fal-ai/kling-video/v3/standard/text-to-video` | 标准 T2V |
| fal.ai | `fal-ai/kling-video/v3/standard/image-to-video` | 标准 I2V |
| fal.ai | `fal-ai/kling-video/v3/standard/motion-control` | 动作控制 |
| Runware | `klingai:kling-video@3-standard` | 标准版 |
| 官方 | `kling-v3-*` | 见官方文档 |

---

## 1. fal.ai 网关

### 文生视频

```
POST https://fal.run/fal-ai/kling-video/v3/standard/text-to-video
```

```bash
curl --request POST \
  --url https://fal.run/fal-ai/kling-video/v3/standard/text-to-video \
  --header "Authorization: Key $FAL_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "prompt": "Cinematic drone shot flying through ancient stone ruins at golden hour",
    "duration": "5",
    "generate_audio": true,
    "aspect_ratio": "16:9",
    "cfg_scale": 0.5
  }'
```

### 图生视频

```
POST https://fal.run/fal-ai/kling-video/v3/standard/image-to-video
```

```json
{
  "prompt": "Camera slowly orbits around the vase",
  "start_image_url": "https://example.com/start.png",
  "duration": "12",
  "generate_audio": true,
  "elements": [
    {
      "frontal_image_url": "https://example.com/front.png",
      "reference_image_urls": ["https://example.com/back.png"]
    }
  ],
  "cfg_scale": 0.5
}
```

### 动作控制

```
POST https://fal.run/fal-ai/kling-video/v3/standard/motion-control
```

```json
{
  "prompt": "A man dancing",
  "image_url": "https://example.com/character.png",
  "video_url": "https://example.com/motion-ref.mp4",
  "character_orientation": "video",
  "keep_original_sound": true
}
```

### 主要参数

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | - | 与 `multi_prompt` 二选一 |
| `multi_prompt` | array | - | 多分镜提示词 |
| `duration` | enum | `5` | 3–15 秒 |
| `generate_audio` | boolean | `true` | 原生音频（中英文） |
| `aspect_ratio` | enum | `16:9` | `16:9` / `9:16` / `1:1` |
| `shot_type` | enum | `customize` | `customize` / `intelligent` |
| `cfg_scale` | float | 0.5 | 0–1，提示词遵循度 |
| `negative_prompt` | string | - | 负向提示 |
| `elements` | array | - | 元素库引用，prompt 中用 @Element1 |
| `start_image_url` | string | - | I2V 起始帧 |
| `end_image_url` | string | - | I2V 结束帧 |

### Output

```json
{
  "video": {
    "url": "https://...",
    "content_type": "video/mp4"
  }
}
```

---

## 2. Kling 官方 API

### 基础信息

- 官网文档：[app.klingai.com/global/dev](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview)
- Base URL：`https://api.klingai.com`
- 认证：AccessKey + SecretKey → JWT Bearer Token

### 调用模式

1. 创建任务（T2V / I2V / 图片生成）
2. 获取 `task_id`
3. 轮询任务状态
4. 下载结果（链接通常 24 小时有效）

### 主要能力

- **原生音频**：支持中英文语音，其他语言自动转英文
- **元素一致性**：上传 2–4 张参考图或角色视频
- **多分镜**：`multi_prompt` 控制镜头切换
- **分辨率**：720p / 1080p
- **计费**：按秒计费，原生音频/无音频模式价格不同

---

## 3. Runware 网关

| 字段 | 值 |
|------|-----|
| Model ID | `klingai:kling-video@3-standard` |
| taskType | `videoInference` |
| 能力 | Text to Video, Image to Video |

---

## 参考链接

- [Kling 官方开发者文档](https://app.klingai.com/global/dev/document-api/quickStart/productIntroduction/overview)
- [fal Kling Video V3 Standard API](https://fal.ai/docs/model-api-reference/video-generation-api/kling-video-v3-standard)
- [Runware Kling VIDEO 3.0](https://runware.ai/docs/models/klingai-video-3-0-standard)
- [Kling VIDEO 3.0 用户指南](https://kling.ai/quickstart/klingai-video-3-model-user-guide)
