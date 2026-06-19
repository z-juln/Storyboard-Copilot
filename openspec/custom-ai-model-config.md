# 通用 AI 模型配置中心

> 展开 `roadmap.md` 中 P0「通用 AI 模型配置中心」。重点是把 Provider、Model、Adapter 分开：一个模型可以多模态、多能力；每个 Adapter 只负责一个具体调用入口。

## 一句话设计

用户配置的不是“某个固定图片模型”，而是一套可执行的 AI 能力：

```text
Provider 供应商 / 网关
  -> Model 模型本体
    -> Adapter 调用入口（chat / text-to-image / image-to-video / ...）
```

这样 Gemini、GPT、Kimi 这类多模态模型可以作为一个 Model 存在，同时挂多个 Adapter。

## 目标

- 普通用户：从预设库添加供应商和模型，填 API Key 后可用。
- 高级用户：手动配置 Provider / Model / Adapter，并粘贴 JS 调用声明。
- AI coding 用户：通过内置 skill 根据 API 文档生成可用 JS 声明。
- 运行时：内置适配器和用户自定义适配器进入同一模型选择体系。

## 非目标

- 不让用户脚本任意访问本机文件、系统命令、DOM、Node API。
- 不把 API Key 暴露给画布节点、项目 JSON、导出配置或错误日志。
- 不要求一开始内置所有供应商；先让自定义 Adapter 能兜底。

## 核心概念

| 概念 | 说明 | 示例 |
|------|------|------|
| Provider | 供应商或网关，负责 Base URL、鉴权方式、Key | OpenAI、fal、KIE、PPIO、自建 OpenAI 网关 |
| Model | 模型本体，描述名称、模型 ID、输入/输出模态 | `gpt-image-2`、`gemini-3-pro-image`、`kimi-k2.6` |
| Capability | 用户可感知能力 | chat、text-to-image、image-to-image、text-to-video |
| Adapter | 某个能力的具体调用声明 | `images/generations`、`chat/completions`、fal task submit/poll |
| Preset | 官方或项目内置配置模板 | OpenAI-compatible chat、Gemini generateContent |

关键规则：

- 一个 Provider 可以有多个 Model。
- 一个 Model 可以有多个 Capability。
- 一个 Capability 可以有一个或多个 Adapter，例如同步调用、异步调用、不同网关入口。
- 节点选择的是“可执行能力”，展示时可合并显示为 `Model / Capability`。

## 产品形态

设置页新增「模型与供应商」分类：

- Provider 列表：启用/禁用、排序、API Key、Base URL、导入/导出。
- Model 列表：显示名称、模型 ID、输入/输出模态、能力标签、所属 Provider。
- Adapter 列表：按能力分组，支持函数或 class JS 调用声明。
- 测试面板：选择 Adapter，输入 prompt / messages / 参考图 / 参数，运行一次并显示标准结果或错误。

节点选模型时按能力过滤：

- 图像节点：展示 `text-to-image`、`image-to-image`。
- 视频节点：展示 `text-to-video`、`image-to-video`。
- 通用对话框：展示 `chat` 或 `multimodal-chat`。
- Auto 模式：在所有已启用 Adapter 中按能力、Key、优先级和输入模态匹配。

## 数据模型

建议新增用户级配置表，与项目数据分离。

```ts
type Modality = 'text' | 'image' | 'video' | 'audio';

type ModelCapability =
  | 'chat'
  | 'multimodal-chat'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-audio'
  | 'audio-to-text';

interface ProviderConfig {
  id: string;
  enabled: boolean;
  displayName: string;
  baseUrl?: string;
  auth: {
    type: 'bearer' | 'api-key-header' | 'query' | 'custom';
    headerName?: string;
    queryName?: string;
  };
  apiKeyRef?: string;
  requestAllowlist?: string[];
  createdAt: number;
  updatedAt: number;
}

interface ModelConfig {
  id: string;
  enabled: boolean;
  providerId: string;
  displayName: string;
  modelName: string;
  inputModalities: Modality[];
  outputModalities: Modality[];
  capabilities: ModelCapability[];
  description?: string;
  createdAt: number;
  updatedAt: number;
}

interface ModelAdapterConfig {
  id: string;
  enabled: boolean;
  providerId: string;
  modelId: string;
  displayName: string;
  capability: ModelCapability;
  adapterKind: 'function' | 'class';
  adapterCode: string;
  defaultParams?: Record<string, unknown>;
  paramsSchema?: ExtraParamDefinition[];
  timeoutMs?: number;
  priority?: number;
  createdAt: number;
  updatedAt: number;
}
```

API Key 单独存：

```ts
interface SecretRecord {
  id: string;
  providerId: string;
  label: string;
  encryptedValue: string;
  updatedAt: number;
}
```

为什么不把 `mediaType` 放在 Model 上：

- 模型本体可能同时支持文本、图像、音频、视频输入输出。
- 具体节点需要的是“能力”，不是单一媒体类型。
- Adapter 才是可执行入口，应该绑定 `capability`。

## 统一调用输入

所有 Adapter 收到同一份上下文。

```ts
interface ModelInvokeContext {
  provider: {
    id: string;
    name: string;
    baseUrl?: string;
  };
  model: {
    id: string;
    name: string;
    inputModalities: Modality[];
    outputModalities: Modality[];
  };
  adapter: {
    id: string;
    capability: ModelCapability;
  };
  input: {
    prompt?: string;
    messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    aspectRatio?: string;
    size?: string;
    resolution?: string;
    referenceImages?: Array<{
      url?: string;
      dataUrl?: string;
      mimeType?: string;
      name?: string;
    }>;
  };
  params: Record<string, unknown>;
  secrets: {
    apiKey?: string;
  };
  helpers: ModelAdapterHelpers;
}
```

`helpers` 只提供安全能力：

```ts
interface ModelAdapterHelpers {
  fetchJson(input: FetchRequest): Promise<FetchResponse>;
  fetchForm(input: FetchRequest): Promise<FetchResponse>;
  sleep(ms: number): Promise<void>;
  uuid(): string;
  assert(condition: unknown, message: string): void;
}
```

禁止暴露 `window`、`document`、`localStorage`、`process`、`fs`、`eval`、动态 import。

## 统一调用输出

Adapter 必须返回标准结果。

```ts
type ModelCallResult =
  | {
      status: 'succeeded';
      outputs: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; url?: string; dataUrl?: string }
        | { type: 'video'; url?: string }
        | { type: 'audio'; url?: string; dataUrl?: string }
      >;
      raw?: unknown;
    }
  | {
      status: 'queued' | 'running';
      task: {
        id: string;
        pollAfterMs?: number;
        providerState?: unknown;
      };
      raw?: unknown;
    }
  | {
      status: 'failed';
      error: string;
      details?: string;
      raw?: unknown;
    };
```

同步 API 直接返回 `succeeded`。异步 API 第一次返回 `queued`，后续调用同一 Adapter 的 `poll(ctx, task)`，直到 `succeeded` 或 `failed`。

## 用户 JS 写法

### 函数声明

适合同步 API，或一次请求即可拿到最终结果的模型。

```js
async function invoke(ctx) {
  const res = await ctx.helpers.fetchJson({
    method: 'POST',
    url: `${ctx.provider.baseUrl}/v1/images/generations`,
    headers: {
      Authorization: `Bearer ${ctx.secrets.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: {
      model: ctx.model.name,
      prompt: ctx.input.prompt,
      size: ctx.input.size,
      ...ctx.params
    }
  });

  const url = res.body?.data?.[0]?.url;
  ctx.helpers.assert(url, '模型未返回图片 URL');

  return {
    status: 'succeeded',
    outputs: [{ type: 'image', url }],
    raw: res.body
  };
}
```

### Class 声明

适合异步任务，需要提交任务和轮询。

```js
class Adapter {
  async invoke(ctx) {
    const res = await ctx.helpers.fetchJson({
      method: 'POST',
      url: `${ctx.provider.baseUrl}/jobs`,
      headers: { Authorization: `Bearer ${ctx.secrets.apiKey}` },
      body: {
        model: ctx.model.name,
        prompt: ctx.input.prompt,
        aspect_ratio: ctx.input.aspectRatio,
        ...ctx.params
      }
    });

    const taskId = res.body?.data?.taskId;
    ctx.helpers.assert(taskId, '提交成功但未返回任务 ID');

    return {
      status: 'queued',
      task: { id: taskId, pollAfterMs: 2500 },
      raw: res.body
    };
  }

  async poll(ctx, task) {
    const res = await ctx.helpers.fetchJson({
      method: 'GET',
      url: `${ctx.provider.baseUrl}/jobs/${task.id}`,
      headers: { Authorization: `Bearer ${ctx.secrets.apiKey}` }
    });

    if (res.body.status === 'running') {
      return { status: 'running', task, raw: res.body };
    }

    if (res.body.status === 'succeeded') {
      return {
        status: 'succeeded',
        outputs: [{ type: 'image', url: res.body.result.url }],
        raw: res.body
      };
    }

    return {
      status: 'failed',
      error: res.body.error || '生成失败',
      raw: res.body
    };
  }
}
```

## 主流模型覆盖方式

| 类型 | Model | Adapter |
|------|-------|---------|
| OpenAI-compatible LLM | `deepseek-v4-pro`, `kimi-k2.6`, 自建网关模型 | `chat` / `multimodal-chat`，通常走 `/chat/completions` |
| OpenAI Responses | `gpt-5.5` 等 | `chat` / `multimodal-chat`，走 `/responses` |
| OpenAI Image | `gpt-image-2` | `text-to-image` / `image-to-image`，走 `/images/generations` 或 `/images/edits` |
| Gemini | `gemini-*`, `gemini-*-image` | `multimodal-chat` / `text-to-image` / `image-to-image`，走 `generateContent` |
| fal | Nano Banana, Kling, Seedance | 多为异步 class Adapter |
| KIE | Seedream, Nano Banana | 异步 class Adapter，常需要参考图上传 |
| PPIO | Seedream, Gemini 网关 | 多为同步函数 Adapter |
| DashScope | Qwen-Image | 函数或 class，按返回任务模式决定 |
| Runware | Kling Image/Video | 函数或 class，按 `deliveryMethod` 决定 |

## 运行时方案

### 最小实现

- 桌面端：Tauri command 接收 `adapterId`，读取 Provider / Model / Adapter / Secret。
- Rust 侧新增 `CustomJsProvider` 或等价运行时，把标准上下文交给 JS sandbox 执行。
- Web 端：同一协议交给后端服务执行，前端不直接运行带 Key 的用户脚本。

### Sandbox 要求

- 限制执行时间、响应体大小、输出大小。
- 用户代码只通过 `helpers.fetchJson/fetchForm` 发请求。
- 请求域名默认限制到 Provider 的 `baseUrl`，高级选项可显式增加 allowlist。
- 错误日志脱敏：不输出 API Key、Authorization、Cookie。
- 禁止访问本机路径和系统命令。

## 与现有代码的关系

现有链路：

```text
ImageModelDefinition.resolveRequest -> submit_generate_image_job -> ProviderRegistry -> Rust AIProvider
```

目标链路：

```text
Capability request -> Runtime Model Registry -> Built-in Adapter 或 Custom JS Adapter
```

保留内置模型作为预设。用户自定义 Model / Adapter 进入同一列表，节点只关心自己需要的 capability。

## 分阶段实现

### M1：配置与协议

- 定义 `ProviderConfig`、`ModelConfig`、`ModelAdapterConfig`、`SecretRecord`、`ModelCallResult`。
- 设置页新增配置中心 UI。
- 支持导入/导出 JSON，但不导出真实 API Key。
- 节点模型下拉合并内置 Adapter 和自定义 Adapter。

### M2：桌面端自定义 JS 运行

- 新增 SQLite 表保存 Provider / Model / Adapter / Secret。
- 新增自定义 JS 运行时。
- 支持函数 `invoke(ctx)`。
- 支持图片同步返回。

### M3：异步任务与多媒体

- 支持 class `invoke/poll`。
- 统一生成任务表保存 task state。
- 支持视频、音频、LLM 文本结果。

### M4：Skill 与预设库

- 内置常见模板：OpenAI-compatible chat、OpenAI image、Gemini generateContent、fal async、KIE async、PPIO sync。
- 提供 `custom-ai-model-adapter-author` skill，辅助用户从 API 文档生成 JS 调用声明。

## 用户编写 Adapter 的 Skill 目标

Skill 应帮助用户完成：

1. 从 API 文档识别端点、鉴权、请求体、响应字段、异步轮询。
2. 判断这是 Provider、Model 还是 Adapter 层的配置。
3. 选择函数或 class。
4. 写出符合 `ModelInvokeContext` / `ModelCallResult` 的 JS。
5. 给出最小测试输入。
6. 明确哪些参数应放入 `paramsSchema`，哪些是固定默认值。

Skill 不应：

- 要求用户把 API Key 写死在代码里。
- 生成 Node.js import、SDK 调用或读取本机文件的代码。
- 使用项目没有提供的 helper。

## 验收

- 用户能手动添加一个 OpenAI-compatible LLM，并在通用对话框调用成功。
- 用户能手动添加一个同步生图 Adapter，并在图片节点生成图片。
- 用户能手动添加一个异步任务 Adapter，并通过 job 轮询得到结果。
- 一个 Model 可同时拥有 `chat`、`text-to-image` 等多个 Adapter。
- 自定义配置导入/导出后，除 API Key 外配置可恢复。
- 错误信息能指向：缺 Key、请求失败、响应字段不匹配、脚本超时。
- 现有内置 KIE / PPIO / fal / Grsai 模型不回退。

## 风险

- 用户 JS 执行安全是最高风险，必须做 sandbox 和网络 allowlist。
- API Key 不能进入项目文件、导出配置、画布节点或前端日志。
- 供应商返回结构差异大，输出协议必须允许保留 `raw` 方便调试。
- 视频和超大图结果可能需要下载/持久化策略，不能只保存远程临时 URL。
