# 前端模块

## 模块职责

| 模块 | 职责 |
|------|------|
| `assetManifest.ts` | register / updatePath / 路径查找 |
| `reconcileProjectAssets.ts` | 打开时对账与迁移 |
| `assetRefIndex.ts` | 扫描 nodes 引用了哪些 fileAssetId |
| `projectAssetService.ts` | CRUD 编排 + manifest 增量 |
| `resolveAssetDisplayUrl.ts` | fileAssetId → HTTP URL |
| `assetExplorerPathUtils.ts` | 路径 join / `findEntryInTree` / `getSiblingEntries` |
| `assetExplorerSelection.ts` | 选区纯函数：顶层去重、路径解析、clipboard items |
| `assetExplorerClipboard.ts` | 复制 / 剪切 / 粘贴 |
| `assetPreviewUtils.ts` | 预览类型、`fetchAssetTextContent` |
| `createUploadNodeFromProjectAsset.ts` | drag payload + upload 节点 data |
| `dropProjectAssetOnCanvas.ts` | 画布 drop 编排 |
| `ui/asset-explorer/` | Explorer UI（controller + selection hook + 子组件） |
| `ui/asset-explorer/useAssetExplorerSelection.ts` | 多选 state、同层全选、anchor |
| `nodes/UploadNodeMediaBody.tsx` | upload 节点多媒体展示 |

## 数据流

```text
ui/asset-explorer/ ──► projectAssetService ──► rustApiClient ──► file_store
Canvas (drop 胶水) ──► dropProjectAssetOnCanvas ──► createUploadNodeFromProjectAsset
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
