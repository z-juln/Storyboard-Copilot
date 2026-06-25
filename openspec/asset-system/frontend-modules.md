# 前端模块

## 模块职责

| 模块 | 职责 |
|------|------|
| `assetManifest.ts` | register / updatePath / 路径查找 / `isProjectAssetAvailable` |
| `reconcileProjectAssets.ts` | 打开时对账、manifest prune、`diskPaths` 输出 |
| `assetRefIndex.ts` | 扫描 nodes 引用了哪些 fileAssetId；manifest 变更后 sync 节点 |
| `useProjectAssetAvailability.ts` | React hook：订阅 manifest + 磁盘索引 |
| `projectAssetService.ts` | CRUD 编排 + manifest 增量 |
| `resolveAssetDisplayUrl.ts` | fileAssetId → 原图或 preview URL（纯函数，磁盘索引由调用方注入） |
| `projectPaths.ts` | `buildProjectAssetUrl` / `buildProjectAssetPreviewUrl` |
| `assetExplorerPathUtils.ts` | 路径 join / `findEntryInTree` / `getSiblingEntries` |
| `assetExplorerSelection.ts` | 选区纯函数：顶层去重、路径解析、selection items |
| `assetExplorerClipboard.ts` | 系统剪贴板读写（HTTP API → Rust NSPasteboard）；cut 标记 |
| `assetPreviewUtils.ts` | 预览类型、`fetchAssetTextContent` |
| `createUploadNodeFromProjectAsset.ts` | drag payload + upload 节点 data；`resolveUploadNodeTypeForMediaKind` |
| `importNodeMediaFromFile.ts` | 画布 upload 视频/音频节点文件导入 |
| `dropProjectAssetOnCanvas.ts` | 画布 drop 已有资产 |
| `dropExternalFileOnCanvas.ts` | 画布空白处外部文件 → 对应 upload 节点 |
| `uploadNodePasteBridge.ts` | 节点挂载前 pending 文件投递 |
| `assetExplorerRevealBridge.ts` | Explorer 未挂载时 pending reveal |
| `resolveDroppedExternalFile.ts` | 外部拖放 File 解析 |
| `ui/CanvasNodeImage.tsx` | 通用图片 + `assetBinding` 不可用态 |
| `ui/CanvasNodeVideo.tsx` / `CanvasNodeAudio.tsx` | 视频/音频节点预览与控制 |
| `ui/MediaPreviewModal.tsx` | 全屏视频/音频/文本（只读）预览 |
| `ui/ImageViewerModal.tsx` | 图片预览（缩放、多图切换） |
| `ui/portalToBody.tsx` | 弹窗 Portal 到 `document.body` |
| `ui/asset-explorer/assetExplorerFileDisplay.tsx` | 目录树文件图标与长名截断 |
| `ui/NodeAssetUnavailableNotice.tsx` | 统一不可用文案 |
| `ui/asset-explorer/` | Explorer UI（controller + selection hook + 子组件） |
| `nodes/UploadNodeMediaBody.tsx` | upload 节点多媒体展示 |
| `nodes/UploadMediaNode.tsx` | upload 视频/音频节点共享实现 |
| `hooks/useUploadMediaNode.ts` | upload 视频/音频节点状态与上传编排 |

## 数据流

```text
ui/asset-explorer/ ──► projectAssetService ──► rustApiClient ──► file_store
Canvas (drop 胶水) ──► dropProjectAssetOnCanvas / dropExternalFileOnCanvas
        │                      │
        ▼                      ▼
assetManifest ◄──────────  assets/**
        ▲
        │ reconcile + refreshAvailableAssetPaths
projectStore.availableAssetPaths
        │
commitAssetManifest ──► syncNodeAssetPathsFromManifest ──► canvasStore.nodes
        │
nodes[].data.fileAssetId ──► isProjectAssetAvailable ──► 展示 URL / 不可用 UI
```

预览由 Rust `preview_cache.rs` 写入 `{project}/.cache/previews/{contentHash}_{max}.png`；`imageData.resolveNodeImageDisplayUrl` 按缩放选择原图或 preview API，并注入 `availableAssetPaths`。

## Store 接口

- `projectStore.commitAssetManifest` — manifest 增量写盘 + sync 节点 path/fileAssetId
- `projectStore.refreshAvailableAssetPaths` — 重扫磁盘、prune manifest、更新 `availableAssetPaths`
- `projectStore.registerPreparedFileAssets` — upload/prepare 落盘后 register
- 打开项目时自动 reconcile（见 [lifecycle.md](lifecycle.md)）

UI 细节见 [explorer-ui.md](explorer-ui.md)、[canvas-binding.md](canvas-binding.md)。
