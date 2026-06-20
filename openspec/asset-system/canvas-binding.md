# 画布绑定

## 从资产目录拖入

从资产目录把**可预览文件**拖到画布，在落点创建 **upload 节点**，绑定已有磁盘资产（不重新上传）。

### 拖拽协议

| 场景 | dataTransfer | dropEffect |
|------|--------------|------------|
| 树内移动到目录 | `text/plain` = 源 path | move |
| 拖到画布 | `application/x-storyboard-copilot-asset` = JSON payload | copy |

Payload 结构（`createUploadNodeFromProjectAsset.ts`）：

```json
{ "path": "assets/foo.png", "name": "foo.png", "mediaKind": "image" }
```

`mediaKind`：`image` | `video` | `audio` | `text`（与预览类型一致）。

### 落点与节点创建

1. `Canvas.tsx` 监听 pane `onDragOver` / `onDrop`（薄胶水）。
2. `screenToFlowPosition` 换算坐标。
3. 资产目录 payload → `dropProjectAssetOnCanvas`；外部图片文件 → `dropExternalImageOnCanvas`。
4. 后者经 `uploadNodePasteBridge` 在 upload 节点挂载后执行 `processFile`（避免竞态）。

文本资产会在创建时 fetch 内容写入 `textContent`（过长截断）。

## 外部图片拖入画布空白

1. `resolveDroppedImageFile` 解析 Files / 图片 item。
2. `dropExternalImageOnCanvas` 创建 upload 节点并 `publishUploadNodePasteImage`。
3. 落盘后 `asset-explorer/reveal-asset` → Explorer 刷新、高亮、面板自动展开（`assetExplorerRevealBridge` 处理未挂载）。

## Upload 节点展示

`UploadImageNodeData` 扩展字段：

| 字段 | 用途 |
|------|------|
| `mediaKind` | `image` / `video` / `audio` / `text` |
| `textContent` | 文本资产内容缓存 |
| `fileAssetId` | 引用 manifest |
| `imageUrl` | 资产相对 path（非图片类型也用于定位文件） |

展示（`UploadNodeMediaBody.tsx`）：

- **image** — `CanvasNodeImage` + `assetBinding`
- **video / audio / text** — 原生控件或 `<pre>`；不可用时统一 `NodeAssetUnavailableNotice`
- 绑定资产后点击节点**不会**再弹出图片文件选择器

## 各类节点的资产绑定 UI

凡展示项目资产的 `CanvasNodeImage`，传入：

```tsx
assetBinding={{ imageUrl, fileAssetId }}
```

删除/缺失/磁盘 orphan 时自动展示不可用提示，并随 `commitAssetManifest` / `refreshAvailableAssetPaths` 刷新。

适用：upload、生图/导出节点、分镜帧、参考图缩略图等。
