# 生命周期与 reconcile

## 打开项目

在 snapshot 灌入 `canvasStore` **之前**，`projectStore.openProject` 调用 `reconcileProjectAssets`：

```text
GET snapshot + assets/tree
        │
        ▼
1. 磁盘 assets/** 无 manifest 项 → register（分配 fileAssetId）
2. 节点 path / fileAssetId → 对齐 manifest；仅有 path → backfill fileAssetId
3. manifest 有 id、磁盘无文件 → broken ref
4. 磁盘有文件、无节点引用 → 未引用
        │
        ▼
manifest / backfill 有变 → 持久化 project.json
        │
        ▼
snapshot → canvasStore
```

实现：`src/features/project/asset/reconcileProjectAssets.ts`

## 增量维护

| 时机 | 动作 |
|------|------|
| 打开项目 | 全量 reconcile |
| upload / prepare 落盘 | register 新 **fileAssetId** |
| 资产面板 mkdir / move / delete / 覆盖写 | 更新 manifest；move 仅改该 id 的 path |
| 拖文件到画布 | 节点写入 **fileAssetId**（必要时 register） |
| 仅改布局 / 连线 | 不动 manifest |

## 展示 URL

```text
fileAssetId → assetManifest[fileAssetId].path
           → GET /api/v1/projects/:id/assets?path=…&v={updatedAt}
```

解析：`resolveAssetDisplayUrl.ts`、`buildProjectAssetUrl`

## 只读项目

`component-doc` 项目：reconcile 只读，禁用资产 CRUD 与 manifest 写入。
