# API 文档检查清单

供 `api-docs-audit` 技能逐文件使用。每项判定：**对 / 错 / 不适用**；错的必须改或写入「需人工确认」。

## README.md

- [ ] 每个模型链接指向存在的 `.md` 文件
- [ ] 「项目已接入供应商」与 `src/features/canvas/models/image/**` 一致
- [ ] 供应商平台表链接有效；fal/KIE/Grsai/PPIO 描述与实现匹配
- [ ] 未接入模型使用 `—`，不臆造供应商

## models/*.md（整合文档）

### 通用

- [ ] frontmatter `model_id` / `providers` 与正文一致
- [ ] 官方链接可访问（spot check）
- [ ] 指向 `providers/` 的相对路径正确

### KIE 章节

- [ ] `POST https://api.kie.ai/api/v1/jobs/createTask`
- [ ] 参考图：说明需公网 URL；链到 `providers/kie/file-upload.md`
- [ ] 任务查询：链到 `providers/kie/task-query.md`
- [ ] `input` 字段名与 KIE 该模型官方文档一致（Nano Banana → `image_input`；Seedream i2i → `image_urls`）
- [ ] 响应 `taskId` 字段名正确

### PPIO 章节

- [ ] Base URL `https://api.ppio.com`
- [ ] 同步响应 `image_urls`（与 `ppio/mod.rs` 一致）
- [ ] Seedream 5.0 路径 `/v3/seedream-5.0-lite`

### fal / Grsai

- [ ] Endpoint ID 与 fal 文档一致（如 `fal-ai/nano-banana-pro`）
- [ ] Grsai host 与 `providers/grsai/nano-banana.md` 一致

## providers/kie/

### README.md

- [ ] 三步流程正确
- [ ] 参考图字段列举 `image_input` 与 `image_urls`
- [ ] 索引表每一行文件存在

### file-upload.md

- [ ] `POST https://kieai.redpandaai.co/api/file-stream-upload`
- [ ] multipart：`file`、`uploadPath`、`fileName`
- [ ] 项目 `uploadPath`：`images/storyboard-copilot`（对照 `kie/mod.rs`）
- [ ] 响应优先 `data.downloadUrl`，兼 `data.fileUrl`
- [ ] 临时文件有效期不写死矛盾数字

### task-query.md

- [ ] `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=`
- [ ] 状态枚举与 `kie/mod.rs` 解析一致（`success` / `fail` 等）
- [ ] 结果取自 `resultJson` → `resultUrls`

### seedream-4.* / z-image.md（抓取文档）

- [ ] 仅查明显错误：死链、错误 model 名、与 5.0 文档矛盾的同一事实
- [ ] 不重写全文

## providers/ppio/

### README.md

- [ ] 同步 API 描述
- [ ] `api.ppinfra.com` 注明为同平台曾用域名
- [ ] 索引文件存在

### seedream-4.0.md / seedream-4.5.md

- [ ] 4.0 使用 `images` 字段；4.5 使用 `image` 字段（与抓取一致）
- [ ] endpoint 路径含正确版本号

## providers/grsai/nano-banana.md

- [ ] 国内/海外 host
- [ ] `/v1/draw/nano-banana` 与 model 枚举与代码使用的 Grsai 模型 id 一致

## 代码变更后的回写触发

若审计期间发现代码已接入但文档未写，**修正 README 与对应 model 文档**，并在报告中注明。

## 快速命令

```bash
# 列出全部文档
find docs/api_docs -name '*.md' | sort

# 已接入模型 id（前端）
rg "export const.*MODEL_ID|id: '" src/features/canvas/models/image --glob '*.ts'

# KIE 常量
rg "const.*_(URL|PATH)" src-tauri/src/ai/providers/kie/mod.rs
```
