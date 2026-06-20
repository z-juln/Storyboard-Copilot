# 前端模块

## 模块职责

| 模块 | 职责 |
|------|------|
| `assetManifest.ts` | register / updatePath / 路径查找 |
| `reconcileProjectAssets.ts` | 打开时对账与迁移 |
| `assetRefIndex.ts` | 扫描 nodes 引用了哪些 fileAssetId |
| `projectAssetService.ts` | CRUD 编排 + manifest 增量 |
| `resolveAssetDisplayUrl.ts` | fileAssetId → HTTP URL |
| `assetExplorerPathUtils.ts` | 路径 join / 树查找 |
| `assetExplorerClipboard.ts` | 复制 / 剪切 / 粘贴 |
| `assetPreviewUtils.ts` | 后缀 → 预览类型 |
| `createUploadNodeFromProjectAsset.ts` | 资产 → upload 节点数据 |

## 数据流

```text
AssetExplorerPanel / Canvas
        │
        ▼
projectAssetService ──► rustApiClient ──► file_store
        │                      │
        ▼                      ▼
assetManifest ◄──────────  assets/**
        ▲
        │ reconcile（打开 + 增量）
projectStore / canvasStore
        │
nodes[].data.fileAssetId ──► manifest ──► 展示 URL
```

## Store 接口

- `projectStore.commitAssetManifest` — manifest 增量写盘
- `projectStore.registerPreparedFileAssets` — upload/prepare 落盘后 register
- 打开项目时自动 reconcile（见 [lifecycle.md](lifecycle.md)）

UI 细节见 [explorer-ui.md](explorer-ui.md)、[canvas-binding.md](canvas-binding.md)。
