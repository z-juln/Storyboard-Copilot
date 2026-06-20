# 资产目录 UI

入口：`AssetManagerPanel` → Tab「资产目录」→ `AssetExplorerPanel`（实现于 `ui/asset-explorer/`）。

## 面板结构

| Tab | 内容 |
|-----|------|
| 资产目录 | IDE 式树：CRUD、DnD 移动、预览、拖文件到画布 |
| 画布节点 | 节点树：定位选中 |

## 目录树交互

- **选中**：左键高亮；`⌘/Ctrl + 点击` 切换多选。
- **同层全选**：有选中项时 `⌘/Ctrl + A` 选中同父目录下全部 siblings（不含 `assets/` 根）。
- **批量操作**：多选后支持统一复制/剪切/删除/拖拽移动；若同时选中目录与其子孙，操作前自动保留顶层项。
- **展开 / 折叠**：目录 chevron；**双击目录**切换展开。
- **双击文件**：打开预览（同右键「预览」）。
- **右键**：新建文件/文件夹、复制/剪切/粘贴、重命名、删除、预览、在文件夹中查找；右键项已在选区时保留多选。
- **根目录空白右键**：`assets/` 根（无重命名/删除）。
- **树内 DnD**：拖到目录 = move；多选时拖任一选中项移动全部；`effectAllowed = copyMove`。
- **快捷键**（非 input/textarea）：`⌘/Ctrl+A/C/X/V`、`Delete`、`⌘+Backspace`；**Enter** 单选时重命名。
- **剪贴板**：复制/剪切/粘贴统一走**系统剪贴板**（macOS 文件 URL）；Explorer 内 ⌘X 剪切通过自定义 cut 标记区分 move；Finder 等外部文件 ⌘V 粘贴经服务端磁盘 import，不经 HTTP body 传文件。
- **删除**：`UiModal` 确认；单项或批量展示引用节点数量。

## 预览

- 支持：图片、视频、音频、文本（后缀规则见 `assetPreviewUtils.ts`）。
- 组件：`AssetPreviewDialog.tsx`。
- URL：`buildProjectAssetUrl(projectId, path)`。

## 只读

`component-doc` 项目禁用 CRUD、DnD move、删除等写操作。
