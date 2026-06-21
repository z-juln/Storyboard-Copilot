# 数据模型

## Project Bundle

```text
{app_data}/projects/{project-id}/
├── project.json       # nodes, edges, viewport, history, assetManifest
├── assets/            # 二进制资源（可嵌套子目录）
└── .cache/
    └── previews/      # 按内容 hash 缓存的缩略图（不入 project.json、不进 manifest）
```

`.cache/` 为派生数据，可整目录删除后按需重建；不参与备份/同步的业务真相。

可选：启用 [Git 版本控制插件](../plugins/README.md) 后，项目根目录可含 `.git/` 与 `.gitignore`（默认仍忽略 `.cache/`）。`project.json` 与 `assets/` 纳入 commit。

## assetManifest

键为 **`fileAssetId`**（文件 id，非 node id）：

```json
{
  "assetManifest": {
    "a1b2c3d4-…": {
      "path": "assets/refs/hero.png",
      "contentHash": "md5…",
      "updatedAt": 1710000000000
    }
  }
}
```

- `contentHash`：源文件 MD5（十六进制），用于 `.cache/previews/` 键与预览命中。
- 上传/落盘时写入；同路径内容覆盖时更新 hash 与 `updatedAt`。

类型定义：`src/features/project/asset/types.ts`  
读写：`projectCodec.ts`、`projectStore.ts`

## 预览缓存

缩略图 **不挂在节点上**，由服务端按源文件内容派生：

```text
.cache/previews/{contentHash}_{maxDimension}.png
```

- 小图可 bypass：预览 API 直接回源 `assets/` 原文件。
- 资源 **移动/重命名** 只改 manifest.path；预览仍按 hash 命中，不会取错图。
- 内容变更 → hash 变更 → 自动生成新缓存文件；旧缓存可惰性淘汰。

前端展示：`GET /projects/:id/assets/preview?path=&max=`（见 [http-api.md](http-api.md)）。

## 节点如何引用文件

节点只**引用** manifest 已有 id，不分配 id：

```json
{
  "fileAssetId": "a1b2c3d4-…",
  "imageUrl": "assets/refs/hero.png"
}
```

- 展示优先 **`fileAssetId → manifest.path`**；迁移期可读 `imageUrl` path 缓存。
- 画布缩小浏览走 preview API；AI/工具/导出链路使用原图 `imageUrl`。
- 分镜帧：`frames[].fileAssetId` + `frames[].imageUrl`。
- 从资产目录拖到画布的 upload 节点额外字段见 [canvas-binding.md](canvas-binding.md)。
- 历史项目中的 `previewImageUrl` / `previewFileAssetId` 在加载时剥离（不再持久化）。

## UI 虚拟根

资产管理面板以 **`assets/` 目录内容**为根展示，不展示 `{project-id}/`、`.cache/` 与 `project.json`。
