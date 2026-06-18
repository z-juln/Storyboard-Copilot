# KIE 供应商

KIE Market API 采用**异步任务**模式，所有图像模型共用同一套平台能力。

## 调用流程

1. **（可选）上传参考图** — 本地/Base64 图需先换为 KIE 可访问的 URL → [file-upload.md](./file-upload.md)
2. **创建任务** — `POST https://api.kie.ai/api/v1/jobs/createTask`（各模型文档中的 `model` + `input`）
3. **查询结果** — `GET .../recordInfo?taskId=...` 或 `callBackUrl` 回调 → [task-query.md](./task-query.md)

## 为什么参考图要走上传

`createTask` 的参考图字段（如 `image_input`、`image_urls`，因模型而异）只接受 **http(s) URI**，KIE 服务器无法读取用户本地磁盘。已是公网 URL 的参考图可直接传入，无需上传。

## 文档索引

| 文档 | 说明 |
|------|------|
| [task-query.md](./task-query.md) | 任务状态查询与轮询 |
| [file-upload.md](./file-upload.md) | 参考图临时上传 |
| [seedream-4.0-t2i.md](./seedream-4.0-t2i.md) | Seedream 4.0 文生图 |
| [seedream-4.0-edit.md](./seedream-4.0-edit.md) | Seedream 4.0 编辑 |
| [seedream-4.5-t2i.md](./seedream-4.5-t2i.md) | Seedream 4.5 文生图 |
| [seedream-4.5-edit.md](./seedream-4.5-edit.md) | Seedream 4.5 编辑 |
| [z-image.md](./z-image.md) | Z-Image |

Seedream 5.0、Nano Banana 等见 [models/](../../models/)。
