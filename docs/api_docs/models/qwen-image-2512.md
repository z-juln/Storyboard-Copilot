---
title: "Qwen-Image 2512 API"
model_id: "qwen-image-max"
provider: "Alibaba DashScope"
type: "image"
official_url: "https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-api"
updated_at: "2026-06-18"
---

# Qwen-Image 2512

阿里通义 Qwen 图像生成模型。API 中 **`qwen-image-max` 即 Qwen-Image-2512** 的官方 model name。

## 模型标识

| Model ID | 说明 |
|----------|------|
| `qwen-image-max` | Qwen-Image-2512（推荐） |
| `qwen-image-plus` | 轻量版，成本更低 |
| `qwen-image-2.0-pro` | 2.0 Pro 系列 |
| `qwen-image-2.0` | 2.0 加速版 |
| `qwen-image-edit-max` | 图像编辑 |
| `qwen-image-edit-plus` | 图像编辑 Plus |

## 端点

| 区域 | URL |
|------|-----|
| 北京 | `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| 新加坡 | `POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |

## 认证

```
Authorization: Bearer $DASHSCOPE_API_KEY
Content-Type: application/json
```

## 文生图示例

```bash
curl --location 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $DASHSCOPE_API_KEY" \
  --data '{
    "model": "qwen-image-max",
    "input": {
      "messages": [{
        "role": "user",
        "content": [
          {"text": "A tidy desk with a notebook and a plant under soft light"}
        ]
      }]
    },
    "parameters": {
      "size": "1024*1024",
      "n": 1,
      "watermark": false,
      "prompt_extend": true
    }
  }'
```

## Python SDK

```python
import os
from dashscope import MultiModalConversation

response = MultiModalConversation.call(
    api_key=os.getenv("DASHSCOPE_API_KEY"),
    model="qwen-image-max",
    messages=[{
        "role": "user",
        "content": [{"text": "A tidy desk with a notebook and a plant"}]
    }],
    result_format="message",
    watermark=False,
    prompt_extend=True,
    size="1328*1328",
)
```

## 图编辑示例

```json
{
  "model": "qwen-image-2.0-pro",
  "input": {
    "messages": [{
      "role": "user",
      "content": [
        {"image": "https://example.com/input.jpg"},
        {"text": "Change the background to a sunset beach"}
      ]
    }]
  },
  "parameters": {
    "n": 1,
    "size": "1024*1536"
  }
}
```

## 主要参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | string | 必填，见上表 |
| `input.messages` | array | 必填，多模态消息 |
| `parameters.size` | string | 格式 `宽*高`（星号，非 x） |
| `parameters.n` | integer | 生成数量，1–6 |
| `parameters.watermark` | boolean | 是否加水印 |
| `parameters.prompt_extend` | boolean | 提示词自动优化 |
| `parameters.negative_prompt` | string | 负向提示词 |
| `parameters.seed` | integer | 随机种子 |

## 注意事项

- 尺寸格式使用 `1024*1024`，不是 `1024x1024`
- 生成图片 URL **24 小时有效**，需及时下载
- 北京/新加坡区域 API Key 独立
- 图编辑支持 1–3 张输入图

## 参考链接

- [Qwen Image Edit API](https://www.alibabacloud.com/help/en/model-studio/qwen-image-edit-api)
- [Qwen API Reference](https://www.alibabacloud.com/help/en/model-studio/qwen-api-reference/)
