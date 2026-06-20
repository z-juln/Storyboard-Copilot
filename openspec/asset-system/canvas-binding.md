# 画布绑定

从资产目录把**可预览文件**拖到画布，在落点创建 **upload 节点**，绑定已有磁盘资产（不重新上传）。

## 拖拽协议

| 场景 | dataTransfer | dropEffect |
|------|--------------|------------|
| 树内移动到目录 | `text/plain` = 源 path | move |
| 拖到画布 | `application/x-storyboard-copilot-asset` = JSON payload | copy |

Payload 结构（`createUploadNodeFromProjectAsset.ts`）：

```json
{ "path": "assets/foo.png", "name": "foo.png", "mediaKind": "image" }
```

`mediaKind`：`image` | `video` | `audio` | `text`（与预览类型一致）。

## 落点与节点创建

1. `Canvas.tsx` 监听 pane `onDragOver` / `onDrop`（薄胶水）。
2. `screenToFlowPosition` 换算坐标。
3. `dropProjectAssetOnCanvas` 调用 `buildUploadNodeDataFromProjectAsset`；必要时 register + `commitAssetManifest`。
4. `canvasStore.addNode(CANVAS_NODE_TYPES.upload, position, data)`。

文本资产会在创建时 fetch 内容写入 `textContent`（过长截断）。

## Upload 节点展示

`UploadImageNodeData` 扩展字段：

| 字段 | 用途 |
|------|------|
| `mediaKind` | `image` / `video` / `audio` / `text` |
| `textContent` | 文本资产内容缓存 |
| `fileAssetId` | 引用 manifest |
| `imageUrl` | 资产相对 path（非图片类型也用于定位文件） |

展示（`UploadNode.tsx`）：

- **image** — `CanvasNodeImage`（原有逻辑）
- **video** — `<video controls>`
- **audio** — `<audio controls>`
- **text** — 只读 `<pre>`；缺内容时按 path 懒加载

绑定资产后点击节点**不会**再弹出图片文件选择器。
