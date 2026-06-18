---
name: api-docs-audit
description: 严格检查并修正 docs/api_docs 下 API 接入文档的正确性。用户手动调用时触发（如「检查 api 文档」「audit api-docs」）。对照代码实现、README 索引、链接与官方 API 核对 endpoint/参数/项目已接入列，发现问题直接修改。
disable-model-invocation: true
---

# API 文档审计（docs/api_docs）

用户**手动调用**本技能时，对 `docs/api_docs/` 做严格正确性检查，并**直接修正**文档（除非用户指定仅检查、或指定范围/排除项）。

## 范围

| 默认 | 说明 |
|------|------|
| 包含 | `docs/api_docs/**/*.md` |
| 排除 | 用户明确说「只查 xxx」「跳过 providers/kie/seedream-4.*」等 |

未指定时：**全目录**。

## 执行流程

```
1. 确定范围 → 2. 读 README 与目录结构 → 3. 对照代码建立「已接入」真相源
   → 4. 逐文件检查 → 5. 修正 → 6. 输出审计报告
```

### 1. 确定范围

- 用户给了路径/文件名：只查这些。
- 用户说「跳过 xxx」：其余全查。
- 否则：`find docs/api_docs -name '*.md'` 列清单后再查。

### 2. 真相源（必须对照，不可凭记忆）

| 检查项 | 对照位置 |
|--------|----------|
| 项目已接入供应商 | `src/features/canvas/models/image/**`、`models/providers/**`、`registry.ts` |
| KIE 端点/上传/轮询 | `src-tauri/src/ai/providers/kie/mod.rs` |
| PPIO 同步生成 | `src-tauri/src/ai/providers/ppio/**` |
| fal / Grsai | `src-tauri/src/ai/providers/fal/**`、`grsai/**` |
| 前端参考图归一化 | `src/features/canvas/infrastructure/tauriAiGateway.ts` |
| 文档索引 | `docs/api_docs/README.md` |

### 3. 检查清单

完整条目见 [references/checklist.md](references/checklist.md)。核心：

**A. 索引与链接**

- `README.md` 表中每一行：文档路径存在；「项目已接入」与代码一致（未接入写 `—`）。
- 文内相对链接、交叉引用可解析（`models/` ↔ `providers/`）。

**B. 事实正确性**

- API Base URL、HTTP 方法、路径与官方或项目常量一致。
- Model ID、请求/响应字段名与官方或 `kie/mod.rs` 等实现一致。
- KIE：`createTask` + `recordInfo`；参考图字段因模型而异（`image_input` / `image_urls`）；本地图需 file-upload。
- PPIO：当前项目为同步 `image_urls`，勿写必须 task 轮询（除非文档描述 PPIO 其他异步接口）。
- 不写主观分类词（如「旧版」「历史版本」作章节标题）；用版本号（如 Seedream 4.x）或事实描述。

**C. 一致性**

- 同一供应商在不同 model 文档中的 endpoint/auth 不矛盾。
- `providers/kie/README.md` 索引与目录内文件一致。

**D. 官方核对（有疑点时）**

- 对 endpoint、字段、有效期等不确定处，fetch 官方文档（如 `docs.kie.ai`、`ppio.com/docs`）再改。
- 官方文档自身矛盾时，写「以响应 `expiresAt` 为准」等可验证表述，不写死单一数字。

### 4. 修正原则

- **只改错与不一致**；不顺手扩写、不新增未请求模型文档。
- 优先改 `models/`、`providers/` 中手写/整合文档；`providers/**/seedream-4.*` 等纯抓取文档仅在明显事实错误（死链、错误域名）时改。
- 修正后保持现有文档风格（中文、表格、cURL 示例）。
- 若 README「项目已接入」列变化，同步检查是否需改 model 文档中的供应商章节。

### 5. 输出报告

完成后用以下结构回复用户：

```markdown
## API 文档审计结果

**范围**：…
**检查文件数**：N | **修改文件数**：M

### 已修正
- `path`：问题 → 改动摘要

### 已核对无误（抽样或全量）
- …

### 未改 / 需人工确认
- …（含无法访问官方文档、代码与官方不一致需产品决策项）
```

无修改时也要说明「检查了哪些、结论无误」。

## 禁止

- 未读代码就改「项目已接入」列。
- 把未接入模型标为已接入。
- 批量重写抓取文档正文（除非用户要求）。
- 只列问题不修改（除非用户明确「只检查不改」）。

## 参考

- 目录约定：`docs/api_docs/README.md`
- 详细检查项：[references/checklist.md](references/checklist.md)
- 供应商扩展（接入新模型后需回写文档）：`.agents/skills/storyboard-provider-model-extension/SKILL.md`
