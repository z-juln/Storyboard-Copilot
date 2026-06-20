# API 接入文档

面向 Video Copilot 供应商/模型扩展的 API 参考。按**模型**组织接入指南，按**供应商**组织平台通用能力。

> 最后整理：2026-06-18。接入前请以各平台最新文档为准。

## 模型接入（按模型查）

### 图像生成

| 模型 | 文档 | 项目已接入供应商 |
|------|------|------------------|
| GPT Image 2.0 | [models/gpt-image-2.0.md](./models/gpt-image-2.0.md) | — |
| Nano Banana Pro | [models/nano-banana-pro.md](./models/nano-banana-pro.md) | fal、KIE、Grsai |
| Nano Banana 2 | [models/nano-banana-2.md](./models/nano-banana-2.md) | fal、KIE、Grsai |
| Seedream 5.0 | [models/seedream-5.0.md](./models/seedream-5.0.md) | — |
| Qwen-Image 2512 | [models/qwen-image-2512.md](./models/qwen-image-2512.md) | — |
| Kling Image 3.0 | [models/kling-image-3.0.md](./models/kling-image-3.0.md) | — |
| Gemini 3 | [models/gemini-3.md](./models/gemini-3.md) | PPIO（Gemini 3.1 Flash） |

### 视频生成

| 模型 | 文档 | 项目已接入供应商 |
|------|------|------------------|
| Seedance 2.0 | [models/seedance-2.0.md](./models/seedance-2.0.md) | — |
| Kling 3.0 | [models/kling-3.0.md](./models/kling-3.0.md) | — |

### 大语言模型

| 模型 | 文档 |
|------|------|
| DeepSeek V4 Pro | [models/deepseek-v4-pro.md](./models/deepseek-v4-pro.md) |
| GPT-5.5 | [models/gpt-5.5.md](./models/gpt-5.5.md) |
| Kimi 2.6 | [models/kimi-2.6.md](./models/kimi-2.6.md) |

## 供应商平台（通用能力）

| 供应商 | 文档 | 说明 |
|--------|------|------|
| KIE | [providers/kie/README.md](./providers/kie/README.md) | 异步任务、参考图上传 |
| fal | [models/nano-banana-pro.md](./models/nano-banana-pro.md) | Nano Banana |
| Grsai | [providers/grsai/nano-banana.md](./providers/grsai/nano-banana.md) | Nano Banana 绘画接口 |
| PPIO | [providers/ppio/README.md](./providers/ppio/README.md) | 同步 API、Seedream 4.x |

## 文档约定

- **models/**：以模型为中心，汇总官方 API + 各网关差异，供新增/扩展模型时查阅。
- **providers/**：供应商平台能力与各模型 API 抓取文档。
