---
title: "GPT Image 2.0 API"
model_id: "gpt-image-2"
provider: "OpenAI"
type: "image"
official_url: "https://developers.openai.com/api/docs/models/gpt-image-2"
updated_at: "2026-06-18"
---

# GPT Image 2.0

OpenAI 最新图像生成模型，支持高质量文生图与图编辑，原生 2K 分辨率，灵活尺寸输入。

## 模型标识

| 别名 | Snapshot |
|------|----------|
| `gpt-image-2` | `gpt-image-2-2026-04-21` |

## 认证

```
Authorization: Bearer $OPENAI_API_KEY
```

## 端点

| 能力 | 方法 | 端点 |
|------|------|------|
| 文生图 | POST | `https://api.openai.com/v1/images/generations` |
| 图编辑 | POST | `https://api.openai.com/v1/images/edits` |
| 对话式生图 | POST | `https://api.openai.com/v1/responses`（配合 `image_generation` 工具） |

## 文生图示例

```bash
curl -X POST "https://api.openai.com/v1/images/generations" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "A professional portrait, studio lighting",
    "size": "1024x1024",
    "quality": "high",
    "n": 1
  }'
```

```python
from openai import OpenAI
client = OpenAI()

result = client.images.generate(
    model="gpt-image-2",
    prompt="A professional portrait, studio lighting",
    size="1024x1024",
    quality="high",
)
```

## 主要参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 必填，`gpt-image-2` |
| `prompt` | string | 必填，最长约 32000 字符 |
| `n` | integer | 生成数量，1–10 |
| `size` | string | 任意满足约束的分辨率（见下） |
| `quality` | string | `low` / `medium` / `high` |
| `response_format` | string | `url` 或 `b64_json` |

### 尺寸约束

- 最大边长 < 3840px
- 宽高均为 16 的倍数
- 长宽比 ≤ 3:1
- 总像素：655,360 – 8,294,400

## Responses API 多轮生图

```python
response = client.responses.create(
    model="gpt-5.5",
    input="Generate an image of a gray tabby cat hugging an otter",
    tools=[{"type": "image_generation"}],
)
```

支持 `previous_response_id` 多轮编辑；`action` 可选 `auto` / `generate` / `edit`。

## 计费

Token 计费（非固定单价）：

| Token 类型 | 价格 |
|-----------|------|
| Image input | $8.00 / 1M tokens |
| Cached image input | $2.00 / 1M tokens |
| Image output | $30.00 / 1M tokens |
| Text input | $5.00 / 1M tokens |

## 参考链接

- [模型页](https://developers.openai.com/api/docs/models/gpt-image-2)
- [Image generation 指南](https://developers.openai.com/api/docs/guides/image-generation)
- [Prompting 指南](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
