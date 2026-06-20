# Asset System

`assets/` 下文件的稳定 id、manifest、reconcile、资产目录 UI，以及画布引用。

## 文档索引

| 文件 | 职责 |
|------|------|
| [terminology.md](terminology.md) | 术语：`fileAssetId`、manifest、绑定 |
| [data-model.md](data-model.md) | Project Bundle、`assetManifest`、节点字段 |
| [lifecycle.md](lifecycle.md) | 打开时对账与 manifest 增量维护 |
| [http-api.md](http-api.md) | Rust HTTP 资产 CRUD |
| [frontend-modules.md](frontend-modules.md) | 前端模块与数据流 |
| [explorer-ui.md](explorer-ui.md) | 资产目录面板交互 |
| [canvas-binding.md](canvas-binding.md) | 拖文件到画布、Upload 节点展示 |

## 实现状态（摘要）

| 能力 | 状态 |
|------|------|
| `assetManifest` + `projectCodec` | 已实现 |
| 打开项目 `reconcileProjectAssets` | 已实现 |
| 节点 `fileAssetId` / `previewFileAssetId` | 已实现 |
| HTTP assets CRUD + tree | 已实现 |
| `AssetExplorerPanel` IDE 式目录 | 已实现 |
| 双击 / 右键预览 | 已实现 |
| 拖文件到画布创建 upload 节点 | 已实现 |
| 图片 / 视频 / 音频 / 文本节点展示 | 已实现（扩展 `UploadNode`） |

迭代验收清单：[`../changes/editable-asset-explorer.md`](../changes/editable-asset-explorer.md)

## 代码入口

- 前端：`src/features/project/asset/`、`AssetManagerPanel.tsx`、`AssetExplorerPanel.tsx`
- 画布绑定：`createUploadNodeFromProjectAsset.ts`、`Canvas.tsx`
- 后端：`src-tauri/src/project/file_store.rs`、`src-tauri/src/http/mod.rs`
