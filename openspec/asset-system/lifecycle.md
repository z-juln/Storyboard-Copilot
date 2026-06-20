# 生命周期与 reconcile

## 打开项目

在 snapshot 灌入 `canvasStore` **之前**，`projectStore.openProject` 调用 `reconcileProjectAssets`：

```text
GET snapshot + assets/tree
        │
        ▼
1. 磁盘 assets/** 无 manifest 项 → register（分配 fileAssetId）
2. manifest 有项、磁盘无文件 → 从 manifest  prune（孤儿条目）
3. 节点 path / fileAssetId → 对齐 manifest；仅有 path → backfill fileAssetId
4. 磁盘有文件、无节点引用 → 未引用（保留在 manifest）
        │
        ▼
写入 availableAssetPaths（磁盘 path 索引）+ manifest / nodes 有变 → 持久化
        │
        ▼
snapshot → canvasStore；Canvas 挂载后再 refreshAvailableAssetPaths 一次
```

实现：`src/features/project/asset/reconcileProjectAssets.ts`

## 增量维护

| 时机 | 动作 |
|------|------|
| 打开项目 | 全量 reconcile + 建立 `availableAssetPaths` |
| upload / prepare 落盘 | register 新 **fileAssetId** + 更新磁盘索引 |
| 资产面板 delete / move / rename / 导入 | `commitAssetManifest` + `refreshAvailableAssetPaths` |
| 拖文件到画布空白 | 创建 upload 节点 + `uploadNodePasteBridge` 绑定文件 |
| 仅改布局 / 连线 | 不动 manifest |

## 可用性判断（manifest + 磁盘）

项目相对路径资产是否可用，由 `isProjectAssetAvailable(manifest, binding, availableAssetPaths)` 判定：

- 有磁盘索引时：**manifest 与磁盘索引均包含**该 path 才可用
- 无磁盘索引时（加载中）：仅看 manifest

Hook：`useProjectAssetAvailability` / `useIsProjectAssetUnavailable`（订阅 manifest 与 `availableAssetPaths`）。

## 展示 URL

```text
fileAssetId → assetManifest[fileAssetId].path
           → isProjectAssetAvailable?
           → GET /api/v1/projects/:id/assets?path=…&v={updatedAt}
```

不可用时不生成 URL；`CanvasNodeImage` 传入 `assetBinding` 时展示「该资源已不存在，可能被手动删除」。

解析：`resolveAssetDisplayUrl.ts`（纯函数，磁盘索引由 `imageData` 注入）、`buildProjectAssetUrl`

## 只读项目

`component-doc` 项目：reconcile 只读，禁用资产 CRUD 与 manifest 写入。
