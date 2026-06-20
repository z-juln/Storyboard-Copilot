import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Search,
  X,
} from 'lucide-react';

import { UiButton, UiInput, UiModal } from '@/components/ui';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import {
  getAssetExplorerClipboard,
  setAssetExplorerClipboard,
} from '@/features/project/asset/assetExplorerClipboard';
import {
  filterTreeByQuery,
  getAssetBaseName,
  getAssetParentPath,
  isDescendantAssetPath,
  joinAssetPath,
  collectFilePathsFromEntry,
} from '@/features/project/asset/assetExplorerPathUtils';
import { normalizeAssetPath } from '@/features/project/asset/assetManifest';
import {
  countAssetPathRefs,
  createProjectAssetFile,
  createProjectAssetFolder,
  deleteProjectAssetEntry,
  moveProjectAssetEntry,
  pasteAssetExplorerClipboard,
  renameProjectAssetEntry,
  resolveNewSiblingName,
} from '@/features/project/asset/projectAssetService';
import { createEmptyAssetManifest } from '@/features/project/asset';
import {
  isAssetPreviewable,
  resolveAssetPreviewKind,
} from '@/features/project/asset/assetPreviewUtils';
import {
  PROJECT_ASSET_DRAG_MIME,
  serializeProjectAssetDragPayload,
} from '@/features/canvas/application/createUploadNodeFromProjectAsset';
import { rustApiClient } from '@/infrastructure/rustApiClient';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

import { AssetPreviewDialog, type AssetPreviewState } from './AssetPreviewDialog';

interface DeleteConfirmState {
  entry: ProjectDirectoryEntry;
  refCount: number;
}

interface AssetExplorerDeleteDialogProps {
  state: DeleteConfirmState | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function AssetExplorerDeleteDialog({
  state,
  isDeleting,
  onCancel,
  onConfirm,
}: AssetExplorerDeleteDialogProps) {
  const entry = state?.entry;
  const refCount = state?.refCount ?? 0;

  return (
    <UiModal
      isOpen={Boolean(entry)}
      title="删除资产"
      onClose={onCancel}
      widthClassName="w-[420px]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" disabled={isDeleting} onClick={onCancel}>
            取消
          </UiButton>
          <UiButton variant="primary" size="sm" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? '删除中…' : '删除'}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-text-dark">
        {refCount > 0 ? (
          <>
            「<span className="font-medium">{entry?.name}</span>」被{' '}
            <span className="font-medium text-accent">{refCount}</span> 处画布节点引用。
            删除后这些引用将失效，确定要继续吗？
          </>
        ) : (
          <>
            确定删除「<span className="font-medium">{entry?.name}</span>」吗？
            此操作不可撤销。
          </>
        )}
      </p>
    </UiModal>
  );
}

interface AssetExplorerPanelProps {
  projectId: string;
  readOnly?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: ProjectDirectoryEntry;
  isAssetsRoot?: boolean;
}

interface ExplorerTreeItemProps {
  entry: ProjectDirectoryEntry;
  depth: number;
  selectedPath: string | null;
  dropTargetPath: string | null;
  renamingPath: string | null;
  readOnly: boolean;
  onSelect: (path: string) => void;
  onContextMenu: (event: MouseEvent, entry: ProjectDirectoryEntry) => void;
  onRenameCommit: (entry: ProjectDirectoryEntry, nextName: string) => void;
  onRenameCancel: () => void;
  onDragStart: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onDragOver: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onDragLeave: (entry: ProjectDirectoryEntry) => void;
  onDrop: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onOpenPreview: (entry: ProjectDirectoryEntry) => void;
}

function formatBytes(size?: number): string {
  if (!size || size <= 0) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|avif|tiff?)$/i.test(name);
}

function ExplorerTreeItem({
  entry,
  depth,
  selectedPath,
  dropTargetPath,
  renamingPath,
  readOnly,
  onSelect,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenPreview,
}: ExplorerTreeItemProps) {
  const isDirectory = entry.kind === 'directory';
  const hasChildren = Boolean(entry.children?.length);
  const [expanded, setExpanded] = useState(depth === 0);

  useEffect(() => {
    if (!renamingPath || entry.kind !== 'directory') {
      return;
    }
    if (isDescendantAssetPath(entry.path, renamingPath)) {
      setExpanded(true);
    }
  }, [entry.kind, entry.path, renamingPath]);
  const isSelected = selectedPath === entry.path;
  const isDropTarget = dropTargetPath === entry.path && isDirectory;
  const isRenaming = renamingPath === entry.path;
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const icon = isDirectory
    ? expanded
      ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" />
      : <Folder className="h-3.5 w-3.5 shrink-0 text-accent/80" />
    : isImageFileName(entry.name)
      ? <ImageIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
      : <File className="h-3.5 w-3.5 shrink-0 text-text-muted" />;

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        draggable={!readOnly && !isRenaming}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${
          isSelected ? 'bg-accent/15 text-accent' : 'text-text-dark hover:bg-bg-dark/70'
        } ${isDropTarget ? 'ring-1 ring-accent/60' : ''} ${isDirectory ? 'font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(entry.path)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (entry.kind === 'file') {
            onOpenPreview(entry);
            return;
          }
          if (hasChildren) {
            setExpanded((value) => !value);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onContextMenu(event, entry);
        }}
        onDragStart={(event) => onDragStart(event, entry)}
        onDragOver={(event) => onDragOver(event, entry)}
        onDragLeave={() => onDragLeave(entry)}
        onDrop={(event) => onDrop(event, entry)}
      >
        <button
          type="button"
          className="inline-flex h-3 w-3 shrink-0 items-center justify-center"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) {
              setExpanded((value) => !value);
            }
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-text-muted" />
            ) : (
              <ChevronRight className="h-3 w-3 text-text-muted" />
            )
          ) : (
            <span className="inline-block h-3 w-3" />
          )}
        </button>
        {icon}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            defaultValue={entry.name}
            className="min-w-0 flex-1 rounded border border-border-dark bg-bg-dark/40 px-1 py-0.5 text-xs text-text-dark outline-none focus:border-accent"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                onRenameCommit(entry, event.currentTarget.value.trim());
              }
              if (event.key === 'Escape') {
                onRenameCancel();
              }
            }}
            onBlur={(event) => {
              onRenameCommit(entry, event.currentTarget.value.trim());
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
        )}
        {!isDirectory && entry.size ? (
          <span className="shrink-0 text-[10px] text-text-muted">{formatBytes(entry.size)}</span>
        ) : null}
      </div>
      {expanded && entry.children?.map((child) => (
        <ExplorerTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          dropTargetPath={dropTargetPath}
          renamingPath={renamingPath}
          readOnly={readOnly}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onRenameCommit={onRenameCommit}
          onRenameCancel={onRenameCancel}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onOpenPreview={onOpenPreview}
        />
      ))}
    </div>
  );
}

interface ContextMenuProps {
  state: ContextMenuState;
  readOnly: boolean;
  canPaste: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFindInFolder: () => void;
}

function AssetExplorerContextMenu({
  state,
  readOnly,
  canPaste,
  onClose,
  onNewFile,
  onNewFolder,
  onCopy,
  onCut,
  onPaste,
  onPreview,
  onRename,
  onDelete,
  onFindInFolder,
}: ContextMenuProps) {
  const isDirectory = state.entry.kind === 'directory';
  const isAssetsRoot = state.isAssetsRoot === true;
  const canPreview = !isDirectory && isAssetPreviewable(state.entry.name);

  useEffect(() => {
    const handlePointerDown = () => onClose();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const items: Array<{ label: string; action: () => void; hidden?: boolean; disabled?: boolean }> = [
    { label: '预览', action: onPreview, hidden: !canPreview },
    { label: '新建文件', action: onNewFile, hidden: !isDirectory, disabled: readOnly },
    { label: '新建文件夹', action: onNewFolder, hidden: !isDirectory, disabled: readOnly },
    { label: '复制', action: onCopy, disabled: readOnly },
    { label: '剪切', action: onCut, disabled: readOnly },
    { label: '粘贴', action: onPaste, hidden: !isDirectory, disabled: readOnly || !canPaste },
    { label: '重命名', action: onRename, hidden: isAssetsRoot, disabled: readOnly },
    { label: '删除', action: onDelete, hidden: isAssetsRoot, disabled: readOnly },
    { label: '在文件夹中查找', action: onFindInFolder, hidden: !isDirectory },
  ];

  return createPortal(
    <div
      className="fixed z-[100] min-w-[10rem] overflow-hidden rounded-lg border border-border-dark bg-bg-light py-1 shadow-xl dark:bg-bg-dark"
      style={{ left: state.x, top: state.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            className="flex w-full px-3 py-1.5 text-left text-xs text-text-dark hover:bg-bg-dark/70 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
    </div>,
    document.body
  );
}

export const AssetExplorerPanel = memo(({ projectId, readOnly = false }: AssetExplorerPanelProps) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);

  const [tree, setTree] = useState<ProjectDirectoryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchScope, setSearchScope] = useState<{ path: string; query: string } | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewState, setPreviewState] = useState<AssetPreviewState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const manifest = assetManifest ?? createEmptyAssetManifest();

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextTree = await rustApiClient.listProjectAssetsTree(projectId);
      setTree(nextTree);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载资产树失败');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  const displayTree = useMemo(() => {
    if (!tree) {
      return null;
    }
    if (!searchScope?.query.trim()) {
      return tree;
    }
    return filterTreeByQuery(tree, searchScope.path, searchScope.query);
  }, [searchScope, tree]);

  const selectedEntry = useMemo(() => {
    if (!tree || !selectedPath) {
      return null;
    }
    const walk = (entry: ProjectDirectoryEntry): ProjectDirectoryEntry | null => {
      if (normalizeAssetPath(entry.path) === normalizeAssetPath(selectedPath)) {
        return entry;
      }
      for (const child of entry.children ?? []) {
        const found = walk(child);
        if (found) {
          return found;
        }
      }
      return null;
    };
    return walk(tree);
  }, [selectedPath, tree]);

  const canPaste = Boolean(getAssetExplorerClipboard()?.items.length);

  const applyManifest = useCallback(
    (nextManifest: typeof manifest) => {
      commitAssetManifest(nextManifest);
    },
    [commitAssetManifest]
  );

  const setClipboardForEntry = useCallback(
    (entry: ProjectDirectoryEntry, mode: 'copy' | 'cut') => {
      if (readOnly) {
        return;
      }
      setAssetExplorerClipboard({
        mode,
        items: [
          {
            path: entry.path,
            kind: entry.kind === 'directory' ? 'directory' : 'file',
          },
        ],
      });
    },
    [readOnly]
  );

  const copySelectionToClipboard = useCallback(
    (mode: 'copy' | 'cut') => {
      if (!selectedEntry) {
        return;
      }
      setClipboardForEntry(selectedEntry, mode);
    },
    [selectedEntry, setClipboardForEntry]
  );

  const handlePasteToDirectory = useCallback(
    async (targetDirPath: string) => {
      if (readOnly || !tree) {
        return;
      }
      const clipboard = getAssetExplorerClipboard();
      if (!clipboard?.items.length) {
        return;
      }

      try {
        const nextManifest = await pasteAssetExplorerClipboard({
          projectId,
          targetDirPath,
          clipboard,
          tree,
          manifest,
        });
        applyManifest(nextManifest);
        if (clipboard.mode === 'cut') {
          setAssetExplorerClipboard(null);
        }
        await loadTree();
      } catch (pasteError) {
        setError(pasteError instanceof Error ? pasteError.message : '粘贴失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly, tree]
  );

  const openPreview = useCallback((entry: ProjectDirectoryEntry) => {
    if (entry.kind !== 'file') {
      return;
    }
    const kind = resolveAssetPreviewKind(entry.name);
    if (!kind) {
      return;
    }
    setPreviewState({ entry, kind });
  }, []);

  const requestDelete = useCallback(
    (entry: ProjectDirectoryEntry) => {
      if (readOnly) {
        return;
      }
      const filePaths = collectFilePathsFromEntry(entry);
      const refCount = countAssetPathRefs(manifest, nodes, filePaths);
      setDeleteConfirm({ entry, refCount });
    },
    [manifest, nodes, readOnly]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm || isDeleting) {
      return;
    }

    const { entry } = deleteConfirm;
    setIsDeleting(true);
    try {
      const nextManifest = await deleteProjectAssetEntry({
        projectId,
        entry,
        manifest,
      });
      applyManifest(nextManifest);
      if (selectedPath && isDescendantAssetPath(entry.path, selectedPath)) {
        setSelectedPath(null);
      }
      setDeleteConfirm(null);
      await loadTree();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  }, [
    applyManifest,
    deleteConfirm,
    isDeleting,
    loadTree,
    manifest,
    projectId,
    selectedPath,
  ]);

  const handleRenameCommit = useCallback(
    async (entry: ProjectDirectoryEntry, nextName: string) => {
      setRenamingPath(null);
      if (readOnly || !nextName || nextName === entry.name) {
        return;
      }

      try {
        const nextManifest = await renameProjectAssetEntry({
          projectId,
          entry,
          nextName,
          manifest,
        });
        applyManifest(nextManifest);
        const nextPath = joinAssetPath(getAssetParentPath(entry.path), nextName);
        setSelectedPath(nextPath);
        await loadTree();
      } catch (renameError) {
        setError(renameError instanceof Error ? renameError.message : '重命名失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly]
  );

  const collectSiblingNames = useCallback((dirEntry: ProjectDirectoryEntry): string[] => {
    if (dirEntry.kind !== 'directory') {
      return [];
    }
    return (dirEntry.children ?? []).map((child) => child.name);
  }, []);

  const handleCreateInDirectory = useCallback(
    async (dirEntry: ProjectDirectoryEntry, kind: 'file' | 'directory') => {
      if (readOnly || dirEntry.kind !== 'directory') {
        return;
      }

      const siblingNames = collectSiblingNames(dirEntry);
      const name = resolveNewSiblingName(kind, siblingNames);
      const parentDirPath = dirEntry.path;

      try {
        if (kind === 'directory') {
          const path = await createProjectAssetFolder({
            projectId,
            parentDirPath,
            name,
          });
          await loadTree();
          setSelectedPath(path);
          setRenamingPath(path);
          return;
        }

        const created = await createProjectAssetFile({
          projectId,
          parentDirPath,
          name,
          manifest,
        });
        applyManifest(created.manifest);
        await loadTree();
        setSelectedPath(created.path);
        setRenamingPath(created.path);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : '创建失败');
      }
    },
    [applyManifest, collectSiblingNames, loadTree, manifest, projectId, readOnly]
  );

  const handleMoveEntry = useCallback(
    async (sourcePath: string, targetDirPath: string) => {
      if (readOnly) {
        return;
      }
      const sourceNormalized = normalizeAssetPath(sourcePath);
      const targetDir = normalizeAssetPath(targetDirPath).replace(/\/+$/, '') || 'assets';
      if (isDescendantAssetPath(sourceNormalized, targetDir)) {
        return;
      }

      const baseName = getAssetBaseName(sourceNormalized);
      const nextPath = joinAssetPath(targetDir, baseName);
      if (normalizeAssetPath(nextPath) === sourceNormalized) {
        return;
      }

      try {
        const nextManifest = await moveProjectAssetEntry({
          projectId,
          fromPath: sourceNormalized,
          toPath: nextPath,
          manifest,
        });
        applyManifest(nextManifest);
        setSelectedPath(nextPath);
        await loadTree();
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : '移动失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const isDeleteShortcut =
        event.key === 'Delete' || (event.metaKey && event.key === 'Backspace');

      if (isDeleteShortcut) {
        if (readOnly || !selectedEntry || !tree) {
          return;
        }
        if (normalizeAssetPath(selectedEntry.path) === normalizeAssetPath(tree.path)) {
          return;
        }
        event.preventDefault();
        requestDelete(selectedEntry);
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'c') {
        event.preventDefault();
        copySelectionToClipboard('copy');
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        copySelectionToClipboard('cut');
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        const pasteTarget = selectedEntry?.kind === 'directory'
          ? selectedEntry.path
          : selectedEntry
            ? getAssetParentPath(selectedEntry.path)
            : 'assets';
        void handlePasteToDirectory(pasteTarget);
      }
    },
    [
      copySelectionToClipboard,
      handlePasteToDirectory,
      readOnly,
      requestDelete,
      selectedEntry,
      tree,
    ]
  );

  const handleDragStart = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      if (readOnly) {
        event.preventDefault();
        return;
      }
      setDragSourcePath(entry.path);
      setSelectedPath(entry.path);
      event.dataTransfer.setData('text/plain', entry.path);

      if (entry.kind === 'file') {
        const mediaKind = resolveAssetPreviewKind(entry.name);
        if (mediaKind) {
          event.dataTransfer.setData(
            PROJECT_ASSET_DRAG_MIME,
            serializeProjectAssetDragPayload({
              path: entry.path,
              name: entry.name,
              mediaKind,
            })
          );
        }
      }

      event.dataTransfer.effectAllowed = 'copyMove';
    },
    [readOnly]
  );

  const handleDragOver = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      if (readOnly || entry.kind !== 'directory') {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTargetPath(entry.path);
    },
    [readOnly]
  );

  const handleDrop = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      event.preventDefault();
      setDropTargetPath(null);
      if (readOnly || entry.kind !== 'directory') {
        return;
      }
      const sourcePath = dragSourcePath ?? event.dataTransfer.getData('text/plain');
      if (!sourcePath) {
        return;
      }
      void handleMoveEntry(sourcePath, entry.path);
      setDragSourcePath(null);
    },
    [dragSourcePath, handleMoveEntry, readOnly]
  );

  const handleAssetsRootContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!tree) {
        return;
      }
      event.preventDefault();
      setSelectedPath(tree.path);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        entry: tree,
        isAssetsRoot: true,
      });
    },
    [tree]
  );

  const handleAssetsRootDragOver = useCallback(
    (event: DragEvent) => {
      if (readOnly || !tree) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDropTargetPath(tree.path);
    },
    [readOnly, tree]
  );

  const handleAssetsRootDrop = useCallback(
    (event: DragEvent) => {
      if (!tree) {
        return;
      }
      handleDrop(event, tree);
    },
    [handleDrop, tree]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="min-h-[12rem] outline-none"
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
    >
      {searchScope ? (
        <div className="mb-2 flex items-center gap-1 px-1">
          <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          <UiInput
            autoFocus
            value={searchScope.query}
            placeholder={`在 ${getAssetBaseName(searchScope.path)} 中查找…`}
            className="h-7 flex-1 text-xs"
            onChange={(event) => {
              setSearchScope((current) =>
                current ? { ...current, query: event.target.value } : current
              );
            }}
          />
          <button
            type="button"
            className="rounded p-1 text-text-muted hover:bg-bg-dark/70"
            onClick={() => setSearchScope(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {error ? <div className="px-2 py-2 text-xs text-red-400">{error}</div> : null}

      {loading && !tree ? (
        <div className="px-2 py-2 text-xs text-text-muted">加载中…</div>
      ) : null}

      <div
        className={`flex min-h-[10rem] flex-1 flex-col rounded-md ${
          dropTargetPath === tree?.path ? 'ring-1 ring-inset ring-accent/40' : ''
        }`}
        onContextMenu={handleAssetsRootContextMenu}
        onDragOver={handleAssetsRootDragOver}
        onDragLeave={() => {
          if (dropTargetPath === tree?.path) {
            setDropTargetPath(null);
          }
        }}
        onDrop={handleAssetsRootDrop}
      >
        {displayTree?.children?.length ? (
          displayTree.children.map((entry) => (
            <ExplorerTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPath={selectedPath}
              dropTargetPath={dropTargetPath}
              renamingPath={renamingPath}
              readOnly={readOnly}
              onSelect={setSelectedPath}
              onContextMenu={(event, item) => {
                setSelectedPath(item.path);
                setContextMenu({ x: event.clientX, y: event.clientY, entry: item });
              }}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={() => setRenamingPath(null)}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={() => setDropTargetPath(null)}
              onDrop={handleDrop}
              onOpenPreview={openPreview}
            />
          ))
        ) : (
          !loading && (
            <div className="px-2 py-2 text-xs text-text-muted">
              {searchScope?.query ? '无匹配项' : '暂无文件'}
            </div>
          )
        )}
        <div
          className="min-h-[4rem] flex-1"
          aria-hidden
          onClick={() => {
            if (tree) {
              setSelectedPath(tree.path);
            }
          }}
        />
      </div>

      {contextMenu ? (
        <AssetExplorerContextMenu
          state={contextMenu}
          readOnly={readOnly}
          canPaste={canPaste}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            void handleCreateInDirectory(contextMenu.entry, 'file');
          }}
          onNewFolder={() => {
            void handleCreateInDirectory(contextMenu.entry, 'directory');
          }}
          onCopy={() => setClipboardForEntry(contextMenu.entry, 'copy')}
          onCut={() => setClipboardForEntry(contextMenu.entry, 'cut')}
          onPaste={() => {
            if (contextMenu.entry.kind === 'directory') {
              void handlePasteToDirectory(contextMenu.entry.path);
            }
          }}
          onPreview={() => {
            openPreview(contextMenu.entry);
          }}
          onRename={() => setRenamingPath(contextMenu.entry.path)}
          onDelete={() => {
            requestDelete(contextMenu.entry);
          }}
          onFindInFolder={() => {
            if (contextMenu.entry.kind === 'directory') {
              setSearchScope({ path: contextMenu.entry.path, query: '' });
            }
          }}
        />
      ) : null}

      <AssetPreviewDialog
        projectId={projectId}
        state={previewState}
        onClose={() => setPreviewState(null)}
      />

      <AssetExplorerDeleteDialog
        state={deleteConfirm}
        isDeleting={isDeleting}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteConfirm(null);
          }
        }}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
});

AssetExplorerPanel.displayName = 'AssetExplorerPanel';
