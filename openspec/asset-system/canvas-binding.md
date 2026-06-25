# 画布绑定

## 从资产目录拖入

从资产目录把**可预览文件**拖到画布，在落点创建节点并绑定已有磁盘资产（不重新上传）。

| 文件类型 | 节点类型 |
|----------|----------|
| 图片 | `uploadNode`（`mediaKind: image`） |
| 视频 | `uploadVideoNode` |
| 音频 | `uploadAudioNode` |
| `.txt` / `.md` / `.markdown` | `textNode` |
| 其他可预览文本（json 等） | `uploadNode`（`mediaKind: text`） |

节点类型映射见 `resolveUploadNodeTypeForMediaKind()`（`createUploadNodeFromProjectAsset.ts`）。

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
3. 资产目录 payload → `dropProjectAssetOnCanvas`；外部文件 → `dropExternalFileOnCanvas`。
4. 图片走 upload 节点 + `uploadNodePasteBridge`（避免竞态）；视频 / 音频走对应专用节点；文本先 `importExternalFilesToDirectory` 落盘再 `buildTextNodeDataFromProjectAsset`。

文本节点初始尺寸由 `textNodeSizing.ts` 的 `resolveTextNodeInitialSize` 按内容行数估算（宽 600px，高度有上限）。

## 外部文件拖入画布空白

统一入口 `dropExternalFileOnCanvas`（`resolveDroppedExternalFile.ts`）：

| 外部文件 | 行为 |
|----------|------|
| 图片 | 创建 upload 节点 → `publishUploadNodePasteImage` |
| 视频 | 创建 `uploadVideoNode` |
| 音频 | 创建 `uploadAudioNode` |
| `.txt` / `.md` / `.markdown` | 导入 `assets/` → 创建 `textNode` 并绑定 |

1. `resolveDroppedExternalFile` 解析 Files / 首个 file item。
2. 落盘后 `asset-explorer/reveal-asset` → Explorer 刷新、高亮、面板自动展开（`assetExplorerRevealBridge` 处理未挂载）。

## textNode（文本组件）

独立节点类型，**仅右侧 Source 端口**。

| 字段 | 用途 |
|------|------|
| `fileAssetId` | manifest 引用 |
| `imageUrl` | 资产相对 path |
| `sourceFileName` | 原始文件名 |
| `textContent` | 内容缓存 |
| `textSyncedAt` | 与 manifest `updatedAt` 对齐 |

交互：

- 默认预览；**双击**进入编辑；`Escape` / 失焦退出编辑（选中状态下可拖拽节点）。
- 编辑后防抖写盘；与 Explorer 预览弹窗通过 `text-asset/updated` 事件双向同步。
- 画布右键菜单「文本节点」：在 `assets/` 根目录创建唯一 `text-{id}.txt` 并绑定。

## Upload 节点（图片 / 文本）

`UploadImageNodeData` 扩展字段：

| 字段 | 用途 |
|------|------|
| `mediaKind` | `image` / `text` |
| `textContent` | 文本资产内容缓存 |
| `fileAssetId` | 引用 manifest |
| `imageUrl` | 资产相对 path |

展示（`UploadNodeMediaBody.tsx`）：

- **image** — `CanvasNodeImage` + `assetBinding`；双击打开 `ImageViewerModal`
- **text** — 节点内 `<pre>` 预览；**双击**打开只读 `MediaPreviewModal`
- 绑定资产后点击节点**不会**再弹出文件选择器

## Upload 视频 / 音频节点

独立节点类型：`uploadVideoNode`、`uploadAudioNode`。实现共享 `UploadMediaNode.tsx` + `useUploadMediaNode.ts`。

| 节点 | 默认宽高比 | 展示 |
|------|------------|------|
| `uploadVideoNode` | 16:9 | `CanvasNodeVideo` |
| `uploadAudioNode` | 16:3 | `CanvasNodeAudio` |

交互（视频 / 音频共用）：

- 未选中：预览区 `pointer-events-none`，可拖拽节点；视频显示播放图标 overlay
- **选中**：底部 `CanvasNodeMediaControls`（播放/暂停、进度、时间）
- **双击**：打开全屏 `MediaPreviewModal`（与资产目录预览同尺寸）
- 空态：点击或拖拽上传；已绑定资产时点击不再弹出文件选择器
- 导入编排：`importNodeMediaFromFile.ts`

不可用时统一 `NodeAssetUnavailableNotice`。

## 原地替换文件

支持在**保持 `fileAssetId`、相对 path、文件名不变**的前提下替换磁盘内容。适用：资产目录右键「替换文件…」、upload / text / uploadVideo / uploadAudio 节点工具栏「替换」。

| 入口 | 行为 |
|------|------|
| 资产目录 | 选中图片、视频、音频或文本文件 → 替换文件… |
| upload 节点 | 已绑定项目图片 → 工具栏「替换」或拖入/选文件时走替换分支 |
| uploadVideo / uploadAudio | 已绑定媒体 → 同上 |
| text 节点 | 已绑定项目文本 → 工具栏「替换」 |

约束：

- 类型必须匹配（图片 ↔ 图片，视频 ↔ 视频，等）；校验见 `assetReplaceUtils.ts`。
- 替换后 `registerFileAssetPath` 保留同一 `fileAssetId`，仅 bump `updatedAt`；预览 URL 追加 `&v=updatedAt` 破缓存。
- 画布刷新统一走 `commitProjectAssetReplacement` → `refreshCanvasNodesAfterAssetReplace`；写盘前 `persistActiveProjectGraphFromCanvas` 合并最新 edges，避免替换后连线丢失。

## 各类节点的资产绑定 UI

凡展示项目资产的 `CanvasNodeImage`，传入：

```tsx
assetBinding={{ imageUrl, fileAssetId }}
```

删除/缺失/磁盘 orphan 时自动展示不可用提示，并随 `commitAssetManifest` / `refreshAvailableAssetPaths` 刷新。

适用：upload、生图/导出节点、分镜帧、参考图缩略图等。

## Explorer 文本预览

`.txt` / `.md` / `.markdown` 在 `AssetPreviewDialog` 中可编辑；保存时若有关联 `textNode` 会提示同步。预览打开时 Explorer 键盘快捷键与自动抢焦点行为暂停，避免干扰编辑。

## 弹窗与 Portal

所有遮罩类 UI（`UiModal`、`ImageViewerModal`、设置/重命名等）经 `UiBodyPortal` 挂载 `document.body`，避免 React Flow 节点 `transform` 导致 `fixed` 定位异常。
