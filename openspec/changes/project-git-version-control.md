# 项目 Git 版本控制插件

> **P0**：本文档为功能规格与验收清单；实现前以本文为准，实现后勾选 Tasks / Acceptance。

## Goal

- 新增「版本控制（Git）」插件：本机已安装 `git` 则视为**已开启**；未安装则引导用户安装（交互参考本地 Z-Image 插件）。
- 在资产管理面板「资产目录」旁增加 **「版本」** Tab：展示 commit 列表（提交说明 + 版本标识）、提交、删除历史 commit、切换/查看历史版本。
- 插件未就绪时，该 Tab 展示占位与「前往插件列表」引导（参考外部科技节点 → Z-Image 未就绪文案）。
- 每个项目在**项目 Bundle 根目录**执行 `git init`；版本库跟踪 `project.json` 与 `assets/` 等业务资源（`.cache/` 为派生数据，默认 `.gitignore` 排除）。
- 工作区变更列表标注**新增 / 删除 / 移动**；未提交资源支持**单项回退**与**简单 diff**（图片左右对比、文本前后全文对比，不做行级 diff）。
- 版本 Tab **定时刷新**整份项目目录占用（含 `.git/`）；超过 **1 GB** 时在面板提醒用户可删除无用旧版本，**建议仅保留一个历史版本**。

## 背景

Project Bundle 已具备 `project.json + assets/` 自包含结构（见 [`asset-system/data-model.md`](../asset-system/data-model.md)）。用户需要轻量版本历史：提交快照、浏览历史、对比与回退未提交改动，而不离开应用。

与 Z-Image 插件一致：**不依赖 Tauri invoke 作为主通道**，Git 检测与仓库操作走本地 Rust HTTP API（`:1421`）。

## 非目标（本迭代）

- 远程仓库（push/pull/fetch）、分支可视化、merge/rebase 图形化。
- 三方合并冲突 UI、行级 / word-level diff。
- 多项目共用一个 Git 仓库。
- 自动 commit（仅用户显式提交）。

## 插件模型（参考 Z-Image）

| 维度 | Z-Image | Git 版本控制 |
|------|---------|--------------|
| 入口 | 项目管理 → 插件列表 | 同左 |
| 就绪条件 | 安装 + 服务运行 + 模型加载 | 系统 PATH 可执行 `git` 且版本 ≥ 2 |
| 卡片组件 | `ZImagePluginCard` | `GitPluginCard` |
| 状态轮询 | `GET /api/v1/local-zimage/status` | `GET /api/v1/plugins/git/status` |
| 未就绪占位 | 外部科技节点内文案 + `navigateToProjectHomeTab('plugins')` | 资产管理「版本」Tab 内同模式引导 |

### 插件状态

```typescript
interface GitPluginStatus {
  available: boolean;        // which git on PATH
  version: string | null;  // e.g. "2.39.3"
  install_hint: string;    // 平台安装说明（macOS: xcode-select / brew install git）
}

interface ProjectGitStorage {
  totalBytes: number;
  worktreeBytes: number;   // 除 .git 外
  gitBytes: number;        // .git 目录
  updatedAt: number;
  exceedsOneGb: boolean;   // totalBytes > 1_073_741_824
}
```

- `available === true` → 插件卡片状态「已就绪」，版本 Tab 可用。
- `available === false` → 卡片状态「待安装」，展示 `install_hint` 与文档链接。

## 仓库范围

```text
{app_data}/projects/{project-id}/     ← git 仓库根（git init 在此）
├── .git/
├── .gitignore                        ← 插件初始化时写入（可更新）
├── project.json                      ← 必须纳入版本库
├── assets/                           ← 必须纳入版本库
└── .cache/                           ← 默认忽略（派生预览，见 data-model）
```

### 初始化时机

1. 用户首次打开某项目的「版本」Tab 且插件已就绪 → 若根目录无 `.git`，调用 `POST /api/v1/projects/:id/git/init`。
2. `init` 写入默认 `.gitignore`（至少包含 `.cache/`）。
3. **不**自动创建首次 commit；用户点击「提交」后生成。

### 与画布持久化的关系

- `project.json` 为画布真相源；提交前应触发与 `saveCurrentProject` 等价的**刷盘**（或 `persistActiveProjectGraphFromCanvas`），确保 commit 包含最新 nodes/edges。
- 切换历史版本（checkout）后：重新 `openProject` 或从磁盘 reload `project.json` + reconcile assets，刷新画布（见下文「版本切换」）。

## UI：资产管理面板

入口：`AssetManagerPanel`（[`explorer-ui.md`](../asset-system/explorer-ui.md)）。

| Tab | 内容 |
|-----|------|
| 资产目录 | 现有 `AssetExplorerPanel` |
| 画布节点 | 现有节点树 |
| **版本** | **本功能**（插件未就绪 → 占位引导） |

### 版本 Tab · 插件未就绪

- 文案示例：「Git 未安装或未在 PATH 中，无法使用版本控制。请前往 **项目管理 → 插件列表** 查看安装说明。」
- 按钮：`前往插件列表` → `navigateToProjectHomeTab('plugins')`（与 `ExternalTechNode` Z-Image 引导一致）。

### 版本 Tab · 插件已就绪

**布局（自上而下，对齐 VS Code Source Control 风格）：**

0. **占用摘要**（可折叠单行；展开显示工作区 / Git 历史 / 更新时间）
1. **1 GB 警告横幅**（条件显示，见下节）
2. **提交区**：常驻多行输入 + 主按钮「提交」；`⌘/Ctrl+Enter` 快捷提交
3. **更改**（可折叠）：标题 + 数量角标；右侧刷新图标；扁平文件行（图标 + 文件名 + 灰色父路径 + 状态字母 `U/M/D/R`）；悬停显示「打开 / 对比 / 撤销」（**无暂存区**，提交仍 `git add -A`）
4. **历史版本**（可折叠）：扁平 commit 行；标题旁「删除最新」

**不做暂存区**：不提供单文件 stage/unstage，不出现 VS Code 的「+」暂存按钮；提交时一次性 `git add -A`。

#### 项目占用与容量提醒

**统计范围**：项目 Bundle **根目录递归合计**，包含 `project.json`、`assets/`、`.git/`、`.gitignore` 等；**不含**兄弟项目或其它 app 数据。`.cache/` 若在目录内则计入（通常已 gitignore，仍占磁盘）。

**展示位置**：版本 Tab 顶部固定摘要行，例如：

```text
项目占用：1.24 GB（工作区 820 MB · Git 历史 420 MB）· 更新于 18:32:05
```

- **工作区**：根目录下除 `.git/` 外文件合计。
- **Git 历史**：`.git/` 目录合计（对象库为主）。
- 人类可读单位：≥ 1 GB 用 `GB`（1 位小数），否则 `MB` / `KB`。

**定时更新**：

- Tab **可见**且插件已就绪时，前端轮询 `GET /api/v1/projects/:id/git/storage`（或与 `/status` 合并返回）。
- 默认间隔 **30s**；用户点击「刷新」或提交/删版本/checkout 成功后**立即**再拉一次。
- Tab 不可见或切走其它 Tab 时停止轮询（避免后台空转）。

**1 GB 阈值提醒**（`total_bytes > 1_073_741_824`）：

- 在占用摘要下方展示 **warning 横幅**（amber 色，参考 Z-Image 未就绪提示样式），文案要点：
  - 当前项目（含 Git 历史）已超过 1 GB；
  - 大体积多来自 `assets/` 与 `.git` 中重复快照；
  - **建议删除无用的旧版本 commit，历史仅保留一个版本即可**（当前工作区 + 至多 1 条历史 commit；非强制）。
- 横幅可带操作：
  - **「了解如何清理」**：展开简短说明（逐条「删除最新版本」、或多次删除直至只剩 1 条历史；后续迭代可加「精简为单一版本」一键 `git checkout --orphan` + 单 commit，**P0 可不实现一键**，仅文案引导）。
  - 可选 **「不再提醒」**：仅当前项目 session 隐藏横幅（不写盘；刷新应用后恢复）。

**插件列表卡片**（`GitPluginCard`）：可选展示当前打开项目的占用（若实现成本高，P0 仅在版本 Tab 展示即可）。

#### 未提交变更列表

数据源：`git status --porcelain`（Rust 侧解析）。

**行展示**：`文件名` + 截断父路径；右侧状态字母 `U`（新增/未跟踪）、`M`、`D`、`R`（颜色区分）。

**悬停操作**：

- **打开**：`assets/...` → 切到资产目录 Tab 并 reveal；`project.json`（有 HEAD 时）→ 简单 diff
- **对比**：有 HEAD 且非纯新增 → `SimpleAssetDiffDialog`
- **撤销**：`git restore` / 删除未跟踪文件（同原逻辑）

| 状态字母 | Git 含义 | 原 kind |
|----------|----------|---------|
| `U` | 未跟踪/新增 | `added` |
| `M` | 修改 | `modified` |
| `D` | 删除 | `deleted` |
| `R` | 重命名/移动 | `renamed` |

#### 简单 Diff（P0）

不做 unified/行级 diff。

| 资源类型 | 判定 | 展示 |
|----------|------|------|
| 图片 | 扩展名 / MIME | 左：HEAD（或上一版本）预览；右：工作区当前预览 |
| 文本 | `.txt` `.md` `.markdown` 等 | 上下或左右两栏：`之前` / `现在` 全文 |
| `project.json` | 固定 | 两栏 JSON 全文对比（不做字段级 diff） |
| 其他 | — | 仅展示「二进制或不支持预览」+ 文件大小变化 |

Diff 数据源：

- 工作区文件：磁盘直读。
- 已提交侧：`git show HEAD:<path>` 或指定 commit `git show <rev>:<path>`。

#### 提交

- 顶部常驻 **提交说明** 输入（默认 `更新项目`）；`⌘/Ctrl+Enter` 或主按钮「提交」。
- 流程：刷盘 → `git add -A`（respect `.gitignore`）→ `git commit -m "..."`。
- 成功后刷新变更列表与 commit 列表。

#### 历史版本列表

每项展示：

- **版本**：短 hash（7 位）+ 可选序号 `#12`（自 init 起递增，仅 UI 友好）
- **说明**：commit message 首行
- **时间**：author date 本地化

操作：

- **查看**：进入「历史预览模式」（见下），不修改工作区文件直至用户确认切换。
- **删除**（单条 commit）：二次确认；实现为 `git reset --hard <parent-of-selected>` **仅当该 commit 为当前分支 HEAD**；若非 HEAD 则提示「仅支持删除最新版本」或禁用（P0 简化：仅允许删除 **最新一条** commit，即 soft undo last commit 的反向 — `git reset --hard HEAD~1`）。

> P0 删除语义：**删除最新 commit** = `git reset --hard HEAD~1`，工作区与磁盘回退到上一版本；需强确认文案。

#### 版本切换（查看历史）

1. 用户选中历史 commit →「切换到此版本」。
2. 二次确认：「将用该版本覆盖当前项目文件（含 project.json 与 assets），未提交改动会丢失。」
3. 执行：`git checkout <commit> -- .` 或 `git reset --hard <commit>`（P0 用 `reset --hard` 到目标 commit，使 HEAD 指向该版本 — **或** detached checkout + copy tree；推荐 **`git reset --hard <commit>`** 使历史线性可理解，并禁止非快进后续扩展）。
4. 完成后：通知前端 `reload project`（`openProject(currentId)` 或专用 refresh），reconcile assets，重建画布。

**历史预览（只读，可选 P0.5）**：若实现成本高，P0 可仅「切换」无预览；文档保留「查看 = 切换前弹 diff 摘要」为最低要求。

## HTTP API（Rust）

前缀：`/api/v1/projects/:project_id/git/`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/plugins/git/status` | 全局：git 是否可用（不绑项目） |
| GET | `/status` | 项目：是否已 init、当前 branch、HEAD hash、clean/dirty |
| GET | `/storage` | 项目目录占用：`totalBytes`、`worktreeBytes`、`gitBytes`、`updatedAt` |
| POST | `/init` | `git init` + 默认 `.gitignore` |
| GET | `/commits?limit=50` | commit 列表 |
| GET | `/changes` | 未提交变更（含 status + paths + change kind） |
| POST | `/commit` | body: `{ "message": "..." }` |
| POST | `/reset-latest` | 删除最新 commit（`reset --hard HEAD~1`） |
| POST | `/checkout` | body: `{ "commit": "<hash>" }` → hard reset 到该 commit |
| GET | `/blob?commit=<hash>&path=<path>` | 某 commit 下文件内容（供 diff / 预览） |

所有命令在项目 Bundle 根目录执行；`project_id` 映射 `resolve_project_dir`。

`/storage` 实现：Rust 递归遍历项目根目录累加 `metadata.len()`；`.git` 单独统计便于 UI 拆分。大目录计算走 blocking task，避免阻塞 async runtime；结果可短缓存 **5s** 防止轮询打满磁盘。

错误：git 非 0 退出 → 4xx/5xx + stderr 摘要（勿泄露完整路径以外的敏感信息）。

## 前端模块（规划）

| 模块 | 职责 |
|------|------|
| `src/features/plugins/GitPluginCard.tsx` | 插件列表卡片 |
| `src/features/git/useGitPluginStatus.ts` | 轮询全局 git 状态（仿 `useLocalZImageStatus`） |
| `src/features/git/useProjectGitController.ts` | 项目级 commit/changes/checkout + 占用轮询 |
| `src/features/canvas/ui/ProjectVersionPanel.tsx` | 版本 Tab 主 UI（占用摘要、超 1GB 横幅） |
| `src/features/canvas/ui/git/GitCommitForm.tsx` | 提交输入 + 主按钮 |
| `src/features/canvas/ui/git/GitChangesSection.tsx` | 「更改」列表 |
| `src/features/canvas/ui/git/GitChangeRow.tsx` | 单行变更 + 悬停操作 |
| `src/features/canvas/ui/git/GitHistorySection.tsx` | 历史 commit 列表 |
| `src/features/canvas/ui/git/SimpleAssetDiffDialog.tsx` | 图片/文本简单 diff |
| `src-tauri/src/project/git.rs` | git 子进程封装 |
| `src-tauri/src/project/storage.rs` | 项目目录递归计大小（含 `.git`） |
| `src-tauri/src/http/mod.rs` | 路由注册 |

`AssetManagerPanel` 仅增加 Tab 与条件渲染，不写 git 业务逻辑。

## 安全与约束

- 仅操作用户项目目录，禁止任意路径参数。
- `component-doc` 项目：版本 Tab 只读或隐藏写操作（与资产目录 readOnly 一致）。
- 删除 commit / checkout 必须 Modal 二次确认。
- Git 输出 stderr 截断后展示，避免刷屏。

## Tasks

- [ ] Rust：`project/storage.rs`（递归计大小 + worktree / `.git` 拆分）
- [ ] HTTP：`GET .../git/storage` + 上表路由 + `GET /api/v1/plugins/git/status`
- [ ] Rust：`project/git.rs`（init / status / commits / changes / commit / reset / checkout / show blob）
- [ ] 前端：`GitPluginCard` + `PluginListPanel` 注册
- [ ] 前端：`ProjectVersionPanel` + `AssetManagerPanel` 第三 Tab
- [ ] 前端：占用摘要 30s 轮询 + 超 1GB 警告横幅与清理建议文案
- [ ] 前端：未提交列表（新增/删除/移动标签）+ 单项回退 + 简单 diff 弹窗
- [ ] 前端：提交 / 删除最新 commit / 切换版本 + 确认框
- [ ] 切换版本后 reload project + reconcile + 画布刷新
- [ ] 提交前刷盘 `project.json`
- [ ] 默认 `.gitignore` 含 `.cache/`
- [ ] i18n：中英文 key（插件名、Tab、按钮、确认文案）
- [ ] 文档：勾选本文件 Acceptance；稳定段落迁入 `openspec/plugins/`

## Acceptance

- [ ] 本机有 `git` 时，插件列表显示「版本控制 · Git」为**已就绪**；无 git 时显示安装指引。
- [ ] 资产管理面板出现「版本」Tab；无 git 时 Tab 内为插件引导（含「前往插件列表」）。
- [ ] 首次进入版本 Tab 自动 `git init`（若尚未初始化），且 `.gitignore` 忽略 `.cache/`。
- [ ] 修改 `project.json` 或 `assets/` 后，未提交列表正确标注新增/修改/删除/移动。
- [ ] 未提交项可单独回退；图片/文本可打开简单 diff（之前 vs 现在，无行级 diff）。
- [ ] 「提交」后历史列表新增一条，工作区 clean。
- [ ] 「删除最新版本」移除 HEAD commit 并恢复上一版文件内容。
- [ ] 「切换到此版本」将项目文件恢复到指定 commit，重开画布后节点与资产一致。
- [ ] 版本 Tab 展示项目总占用（含 `.git`），Tab 可见时每 30s 自动更新；提交/删版本/手动刷新后立即更新。
- [ ] 总占用 > 1 GB 时显示警告，提示可删除无用旧版本并建议历史仅保留一个版本。
- [ ] `npx tsc --noEmit` 与 `cd src-tauri && cargo check` 通过。

## 参考实现

- 插件卡片与安装流：`src/features/plugins/ZImagePluginCard.tsx`、`LocalZImageInstallFlowPanel`
- 插件 Tab 入口：`src/features/project/ProjectManager.tsx`
- 未就绪引导：`ExternalTechNode.tsx`（`navigateToProjectHomeTab('plugins')`）
- 资产管理 Tab：`src/features/canvas/ui/AssetManagerPanel.tsx`
- 项目目录：`src-tauri/src/project/file_store.rs` → `resolve_project_dir`
