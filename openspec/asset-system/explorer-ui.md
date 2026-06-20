# 资产目录 UI

入口：`AssetManagerPanel` → Tab「资产目录」→ `AssetExplorerPanel`。

## 面板结构

| Tab | 内容 |
|-----|------|
| 资产目录 | IDE 式树：CRUD、DnD 移动、预览、拖文件到画布 |
| 画布节点 | 节点树：定位选中 |

## 目录树交互

- **选中**：左键高亮路径。
- **展开 / 折叠**：目录 chevron；**双击目录**切换展开。
- **双击文件**：打开预览（同右键「预览」）。
- **右键**：新建文件/文件夹、复制/剪切/粘贴、重命名、删除、预览、在文件夹中查找。
- **根目录空白右键**：`assets/` 根（无重命名/删除）。
- **树内 DnD**：拖到目录 = move（`text/plain` 传 path）；`effectAllowed = copyMove`。
- **快捷键**（非 input/textarea）：`⌘/Ctrl+C/X/V`、`Delete`、`⌘+Backspace`。
- **删除**：`UiModal` 确认；展示引用该路径的节点数量。

## 预览

- 支持：图片、视频、音频、文本（后缀规则见 `assetPreviewUtils.ts`）。
- 组件：`AssetPreviewDialog.tsx`。
- URL：`buildProjectAssetUrl(projectId, path)`。

## 只读

`component-doc` 项目禁用 CRUD、DnD move、删除等写操作。
