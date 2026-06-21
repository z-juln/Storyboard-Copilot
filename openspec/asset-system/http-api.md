# HTTP API

经 `rustApiClient` 调用；路径相对 `projects/{id}/`，必须以 `assets/` 开头；禁止 `..` 逃逸。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/projects/:id/assets/tree` | 以 `assets/` 为根的目录树 |
| `POST` | `/projects/:id/assets/directories` | 创建目录 |
| `PUT` | `/projects/:id/assets?path=` | 嵌套路径写文件（query 传 path） |
| `PATCH` | `/projects/:id/assets` | `{ from, to }` move/rename |
| `POST` | `/projects/:id/assets/copy` | `{ from, to }` 磁盘复制（粘贴 copy 用） |
| `POST` | `/projects/:id/assets/import` | `{ targetDir, sources[] }` 从绝对路径磁盘导入（外部粘贴） |
| `POST` | `/projects/:id/assets/upload-sessions` | 创建资产分片上传 session |
| `PUT` | `/projects/:id/assets/upload-sessions/:id/chunks/:index` | 写入分片（≤4MB，octet-stream） |
| `POST` | `/projects/:id/assets/upload-sessions/:id/complete` | `{ path, totalChunks }` 合并写入目标资产 |
| `DELETE` | `/projects/:id/assets/upload-sessions/:id` | 取消 session |
| `GET` | `/projects/:id/clipboard/assets` | 读取系统剪贴板并解析为资产粘贴项 |
| `POST` | `/projects/:id/clipboard/assets` | `{ relativePaths, cut }` 写入系统剪贴板（Finder 同格式） |
| `POST` | `/clipboard/assets/clear-cut` | 清除 Explorer 剪切标记 |
| `DELETE` | `/projects/:id/assets?path=` | 删除文件或空目录 |
| `GET` | `/projects/:id/assets?path=&v=` | 读原图（`v` 为 cache bust） |
| `GET` | `/projects/:id/assets/preview?path=&max=` | 读缩略图（按内容 hash 缓存于 `.cache/previews/`） |

## 本地 Z-Image / 外部科技

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/local-zimage/status` | 安装进度、Python 路径、Gradio 服务状态 |
| `POST` | `/local-zimage/install` | 后台安装（检测 python3，必要时 uv 安装 Python + venv + pip） |
| `POST` | `/local-zimage/server/start` | 启动本地 Gradio（`:7860`） |
| `POST` | `/local-zimage/server/stop` | 停止 Gradio |
| `POST` | `/external-tech/run` | `{ provider_id, prompt, inputs }` → `{ outputs }` |

详见 `openspec/changes/local-zimage.md`。

## 约束

- move/rename：**只改磁盘 + manifest.path**，不批量改节点 JSON。
- 前端 manifest 变更经 `projectAssetService` 编排，再 `commitAssetManifest` 写回 `project.json`。

## 代码入口

- 路由：`src-tauri/src/http/mod.rs`
- 存储：`src-tauri/src/project/file_store.rs`
- 客户端：`src/infrastructure/rustApiClient.ts`
