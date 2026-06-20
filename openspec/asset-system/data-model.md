# 数据模型

## Project Bundle

```text
{app_data}/projects/{project-id}/
├── project.json       # nodes, edges, viewport, history, assetManifest
└── assets/            # 二进制资源（可嵌套子目录）
```

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

类型定义：`src/features/project/asset/types.ts`  
读写：`projectCodec.ts`、`projectStore.ts`

## 节点如何引用文件

节点只**引用** manifest 已有 id，不分配 id：

```json
{
  "fileAssetId": "a1b2c3d4-…",
  "previewFileAssetId": "e5f6…",
  "imageUrl": "assets/refs/hero.png",
  "previewImageUrl": "assets/refs/hero.preview.png"
}
```

- 展示优先 **`fileAssetId → manifest.path`**；迁移期可读 `imageUrl` path 缓存。
- 分镜帧：`frames[].fileAssetId`。
- 从资产目录拖到画布的 upload 节点额外字段见 [canvas-binding.md](canvas-binding.md)。

## UI 虚拟根

资产管理面板以 **`assets/` 目录内容**为根展示，不展示 `{project-id}/` 与 `project.json`。
