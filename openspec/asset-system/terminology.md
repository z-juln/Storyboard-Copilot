# 术语

避免把**文件 id**与**画布节点 id**混用。

| 名称 | 含义 | 不是 |
|------|------|------|
| **`fileAssetId`** | `assets/` 下某个文件在 `assetManifest` 中的稳定 UUID | 画布 `nodeId` |
| **`nodeId`** | React Flow 节点 id（`nodes[].id`） | 文件 id |
| **`assetManifest`** | `fileAssetId → { path, contentHash?, updatedAt }` | 节点列表 |
| **绑定** | 节点字段保存 `fileAssetId`，指向 manifest 中那一个文件 | 节点与节点绑定 |

## 路径与 id 的关系

- 磁盘路径可变（rename / move）；**`fileAssetId` 不变**。
- move/rename 只更新 `assetManifest[fileAssetId].path` 与磁盘；节点里存的 `fileAssetId` 不改。
- 同路径**内容覆盖**：`fileAssetId` 不变，更新 `updatedAt` / `contentHash`。

## 例外

- 远程 URL（`https://`）直接存节点字段，不进 manifest，无 `fileAssetId`。
