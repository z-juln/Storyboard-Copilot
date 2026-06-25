# 资产目录 UI

入口：`AssetManagerPanel` → Tab「资产目录」→ `AssetExplorerPanel`（实现于 `ui/asset-explorer/`）。

## 面板结构

| Tab | 内容 |
|-----|------|
| 资产目录 | IDE 式树：CRUD、DnD 移动、预览、拖文件到画布 |
| 画布节点 | 节点树：定位选中 |
| 版本 | Git 提交历史、未提交变更、简单 diff / 回退（需 [Git 插件](../plugins/README.md)；未就绪时展示插件引导） |

## 目录树交互

- **选中**：左键高亮；`⌘/Ctrl + 点击` 切换多选。
- **同层全选**：有选中项时 `⌘/Ctrl + A` 选中同父目录下全部 siblings（不含 `assets/` 根）。
- **批量操作**：多选后支持统一复制/剪切/删除/拖拽移动；若同时选中目录与其子孙，操作前自动保留顶层项。
- **展开 / 折叠**：目录 chevron；**双击目录**切换展开。
- **双击文件**：打开预览（同右键「预览」）。
- **文件图标**：按类型区分（图片 / 视频 / 音频 / 文本 / 其他），见 `assetExplorerFileDisplay.tsx`。
- **长文件名**：主文件名截断省略，**后缀始终完整显示**（`AssetExplorerTruncatedFileName`）。
- **右键**：新建文件/文件夹、复制/剪切/粘贴、重命名、删除、预览、在文件夹中查找；右键项已在选区时保留多选。
- **根目录空白右键**：`assets/` 根（无重命名/删除）。
- **树内 DnD**：拖到目录 = move；多选时拖任一选中项移动全部；`effectAllowed = copyMove`。
- **外部文件 DnD**：Finder 等拖入目录 = 优先磁盘 import；无路径时走资产分片上传（4MB/chunk，与节点图片上传同源 session 机制）。
- **快捷键**（非 input/textarea）：`⌘/Ctrl+A/C/X/V`、`Delete`、`⌘+Backspace`；**Enter** 单选时重命名。
- **剪贴板**：复制/剪切/粘贴统一走**系统剪贴板**（macOS 文件 URL）；Explorer 内 ⌘X 剪切通过自定义 cut 标记区分 move；Finder 等外部文件 ⌘V 粘贴经服务端磁盘 import，不经 HTTP body 传文件。
- **删除**：`UiModal` 确认；单项或批量展示引用节点数量。

## 预览

- 支持：图片、视频、音频、文本（后缀规则见 `assetPreviewUtils.ts`）。
- **图片**：`canvasStore.openImageViewer` → `ImageViewerModal`（与画布图片节点双击同一组件；同目录图片可左右切换）。
- **视频 / 音频 / 文本**：`AssetPreviewDialog`（视频音频用 `MediaPreviewBody`；文本可编辑 / Markdown）。
- URL：`buildProjectAssetUrl(projectId, path)`。
- 弹窗经 `UiBodyPortal` 挂载 `document.body`。

## 只读

`component-doc` 项目禁用 CRUD、DnD move、删除等写操作。
