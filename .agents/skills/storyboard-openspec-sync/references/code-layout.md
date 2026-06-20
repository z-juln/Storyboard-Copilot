# 代码布局：渐进式披露与单一职责

与根 `AGENTS.md` 数据流一致：**UI → Store → Application → API/Command → 持久化**。

## 核心原则

1. **渐进式披露**：读代码的人先找索引（domain / application / store），再按需打开单职责文件；枢纽文件只做编排。
2. **单一职责**：一个源文件一种**主**职责；允许少量私有 helper，但不允许多条业务链并列。
3. **薄 UI、厚应用层**：可测试、可复用的逻辑放在 `application/` 或 `features/*/xxxService.ts`。
4. **Store 是状态容器**：get/set、快照、debounce；**不**写 manifest 编排、HTTP 序列、拖拽协议解析。

## 按职责选落点

| 职责 | 应放在 | 不应放在 |
|------|--------|----------|
| React 渲染、快捷键、DnD 事件 | `ui/`、`nodes/` | `projectStore` |
| 节点类型、默认 data、连线规则 | `domain/nodeRegistry.ts`、`canvasNodes.ts` | UI 白名单 |
| 资产 CRUD + manifest 增量 | `projectAssetService.ts` | `AssetExplorerPanel` 内 200 行 async |
| 拖拽 MIME、payload、节点 data 构建 | `application/createXxxFromYyy.ts` | `Canvas.tsx` 内联 |
| fileAssetId 注册、path 规范化 | `assetManifest.ts` | 组件内 |
| HTTP 路径与请求体 | `rustApiClient.ts` | 组件内 `fetch` |
| 磁盘与路由 | `file_store.rs`、`http/mod.rs` | 前端 |

## 枢纽文件（只加胶水，不加业务）

以下文件**禁止**持续膨胀；新增能力优先抽模块，枢纽只保留调用：

| 文件 | 允许 | 禁止 |
|------|------|------|
| `Canvas.tsx` | 注册 drop handler、调用 application 工厂 | manifest register、读文件内容、preview 规则 |
| `projectStore.ts` | open/save、commitManifest、reconcile 入口 | Explorer 剪贴板、rename 规则 |
| `AssetExplorerPanel.tsx` | 树 UI、选中态、调 service | 完整 move/delete 编排、ref 计数算法 |
| `UploadNode.tsx` | 展示、本节点 upload 交互 | 项目级 asset path 解析协议 |

## 体量与拆分信号

出现任一情况，**下一次改动**应抽文件或目录，而不是继续加长：

| 信号 | 建议 |
|------|------|
| 单文件 **> ~400 行**且含多种职责 | 按 UI / hook / service 拆分 |
| 同一文件 **3+ 个**独立 `useCallback` 业务链 | 抽到 `application/` |
| 新增 **> ~60 行**纯函数且与 UI 无关 | 新文件或并入现有 domain/application |
| 新子系统 **≥ 3 个**相关 ts 文件 | 子目录 + `index.ts` 导出（如 `asset/`） |
| Rust `mod.rs` 路由与 handler 混在一起 | 拆 `file_store.rs` 或子 module |

体量不是硬上限；**职责混杂**比行数更优先处理。

## 模块划分模式

### 已有范例：`features/project/asset/`

```text
asset/
├── types.ts              # 类型
├── assetManifest.ts      # 纯 manifest 操作
├── reconcileProjectAssets.ts
├── projectAssetService.ts # CRUD 编排
├── assetRefIndex.ts
├── resolveAssetDisplayUrl.ts
├── assetExplorerPathUtils.ts
├── assetPreviewUtils.ts
└── index.ts              # 对外导出
```

新领域仿此：**types → 纯函数 → service → UI**。

### Application 层单文件一事

`application/createUploadNodeFromProjectAsset.ts`：只负责 drag payload + upload 节点 data，不渲染 UI。

## 新增能力检查单（动手前）

- [ ] 数据流每层都有明确落点
- [ ] 没有在枢纽文件堆 >30 行业务逻辑
- [ ] 可复用逻辑不在组件 closure 里
- [ ] 新目录/文件在 `openspec` 或 architecture Change Routing 可发现（若稳定能力）
