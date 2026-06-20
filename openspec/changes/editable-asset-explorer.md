# 可编辑资产目录与画布绑定

> 架构索引：[`../asset-system/README.md`](../asset-system/README.md)

## Goal

- IDE 式编辑 `assets/`；UI 虚拟根为 `assets/` 内容。
- `assets/` 下每个**文件**有稳定 **`fileAssetId`**（manifest 键）；打开项目 reconcile；节点通过 **`fileAssetId` 引用文件**。
- 可预览文件：双击预览；拖到画布创建 upload 节点（图片 / 视频 / 音频 / 文本）。

## Tasks

- [x] `assetManifest`（键 = fileAssetId）；`projectCodec` 编解码
- [x] `reconcileProjectAssets`：磁盘文件 register id、节点 backfill `fileAssetId`
- [x] 节点字段 `fileAssetId` / `previewFileAssetId`；展示 fileAssetId → manifest.path
- [x] Rust：assets CRUD + tree；上传 register 新 fileAssetId
- [x] `AssetExplorerPanel` IDE UI；删除前查「哪些 node 引用该 fileAssetId」
- [x] 双击文件预览；拖文件到画布绑 upload 节点

## Acceptance

- [x] 打开旧项目：每个 assets 文件有 fileAssetId；节点引用正确
- [x] 文件 rename/move：manifest.path 变，节点 fileAssetId 不变
- [x] 覆盖同路径文件：fileAssetId 不变，预览刷新
- [x] 拖**文件**到画布：节点写入该文件的 fileAssetId，并按类型展示
