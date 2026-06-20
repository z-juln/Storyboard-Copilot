# HTTP API

经 `rustApiClient` 调用；路径相对 `projects/{id}/`，必须以 `assets/` 开头；禁止 `..` 逃逸。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/projects/:id/assets/tree` | 以 `assets/` 为根的目录树 |
| `POST` | `/projects/:id/assets/directories` | 创建目录 |
| `PUT` | `/projects/:id/assets?path=` | 嵌套路径写文件（query 传 path） |
| `PATCH` | `/projects/:id/assets` | `{ from, to }` move/rename |
| `DELETE` | `/projects/:id/assets?path=` | 删除文件或空目录 |
| `GET` | `/projects/:id/assets?path=&v=` | 读原图（`v` 为 cache bust） |
| `GET` | `/projects/:id/assets/preview?path=&max=` | 读缩略图（按内容 hash 缓存于 `.cache/previews/`） |

## 约束

- move/rename：**只改磁盘 + manifest.path**，不批量改节点 JSON。
- 前端 manifest 变更经 `projectAssetService` 编排，再 `commitAssetManifest` 写回 `project.json`。

## 代码入口

- 路由：`src-tauri/src/http/mod.rs`
- 存储：`src-tauri/src/project/file_store.rs`
- 客户端：`src/infrastructure/rustApiClient.ts`
