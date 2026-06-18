---
title: "Seedance 2.0 API"
model_id: "bytedance/seedance-2.0"
provider: "ByteDance (via fal / Volcengine / BytePlus)"
type: "video"
official_url: "https://fal.ai/models/bytedance/seedance-2.0/text-to-video/api"
updated_at: "2026-06-18"
---

# Seedance 2.0

字节跳动 Seedance 2.0 视频生成模型，统一多模态音视频架构，支持文生视频、图生视频、多模态参考生成，原生音频同步。

## 模型标识（fal.ai）

| Endpoint ID | 能力 |
|-------------|------|
| `bytedance/seedance-2.0/text-to-video` | 文生视频 |
| `bytedance/seedance-2.0/fast/text-to-video` | 文生视频（快速） |
| `bytedance/seedance-2.0/reference-to-video` | 多模态参考生视频 |
| `bytedance/seedance-2.0/fast/reference-to-video` | 多模态参考（快速） |

## 能力概览

- 输出：480p / 720p / 1080p，4–15 秒
- 宽高比：16:9, 9:16, 4:3, 3:4, 1:1, 21:9
- 原生音频：音效、环境音、口型同步
- 多模态参考：最多 9 张图 + 3 段视频 + 3 段音频

---

## 1. fal.ai 网关

### 端点

```
POST https://fal.run/bytedance/seedance-2.0/text-to-video
```

### 认证

```
Authorization: Key $FAL_KEY
```

### 示例

```javascript
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("bytedance/seedance-2.0/text-to-video", {
  input: {
    prompt: "A golden retriever running through a field of sunflowers",
    resolution: "720p",
    duration: "auto",
    aspect_ratio: "16:9",
    generate_audio: true,
  },
});
```

### Input Schema（text-to-video）

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `prompt` | string | 必填 | 文本提示词 |
| `resolution` | enum | `720p` | `480p` / `720p` / `1080p` |
| `duration` | enum | `auto` | `auto` 或 4–15 秒 |
| `aspect_ratio` | enum | `auto` | 见上 |
| `generate_audio` | boolean | `true` | 是否生成同步音频 |
| `bitrate_mode` | enum | `standard` | `standard` / `high` |
| `seed` | integer | - | 随机种子 |

### Output

```json
{
  "video": { "url": "https://..." },
  "seed": 42
}
```

### 队列模式

```javascript
const { request_id } = await fal.queue.submit("bytedance/seedance-2.0/text-to-video", {
  input: { prompt: "..." },
  webhookUrl: "https://your-domain.com/webhook",
});
```

---

## 2. 官方 Volcengine / BytePlus

### 接入方式

- 国内：[Volcengine 火山引擎](https://www.volcengine.com/)
- 国际：[BytePlus](https://www.byteplus.com/)

### 调用模式

异步任务：提交生成请求 → 获取 `task_id` → 轮询状态 → 下载视频 URL。

典型参数：

| 参数 | 值 | 说明 |
|------|-----|------|
| `model` | `seedance-2.0` | 模型标识 |
| `prompt` | string | 最长约 2000 字符 |
| `resolution` | `480p`/`720p`/`1080p`/`2k` | 输出分辨率 |
| `duration` | 4–15 | 秒 |
| `aspect_ratio` | `16:9`/`9:16`/`1:1`/`4:3` | 画幅 |
| `audio` | boolean | 原生音频 |
| `references` | array | 最多 12 个参考文件 |

---

## 参考链接

- [fal Seedance 2.0 T2V API](https://fal.ai/models/bytedance/seedance-2.0/text-to-video/api)
- [fal Seedance 2.0 GitHub](https://github.com/fal-ai/seedance-2.0-api)
- [Vercel AI Gateway - Seedance 2.0](https://vercel.com/ai-gateway/models/seedance-2.0)
