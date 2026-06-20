import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';

import type { ProjectDirectoryEntry } from '@/features/project/types';
import {
  getAssetExplorerClipboard,
  setAssetExplorerClipboard,
} from '@/features/project/asset/assetExplorerClipboard';
import {
  collectFilePathsFromEntry,
  filterTreeByQuery,
  findEntryInTree,
  getAssetBaseName,
  getAssetParentPath,
  isDescendantAssetPath,
  joinAssetPath,
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
import { createEmptyAssetManifest, type AssetManifest } from '@/features/project/asset';
import { resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';
import {
  PROJECT_ASSET_DRAG_MIME,
  serializeProjectAssetDragPayload,
} from '@/features/canvas/application/createUploadNodeFromProjectAsset';
import { rustApiClient } from '@/infrastructure/rustApiClient';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

import type { AssetPreviewState, ContextMenuState, DeleteConfirmState } from './types';

interface UseAssetExplorerControllerOptions {
  projectId: string;
  readOnly: boolean;
}

export function useAssetExplorerController({
  projectId,
  readOnly,
}: UseAssetExplorerControllerOptions) {
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

  const manifest: AssetManifest = assetManifest ?? createEmptyAssetManifest();

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
    return findEntryInTree(tree, selectedPath);
  }, [selectedPath, tree]);

  const canPaste = Boolean(getAssetExplorerClipboard()?.items.length);

  const applyManifest = useCallback(
    (nextManifest: AssetManifest) => {
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

  const handleTreeContextMenu = useCallback((event: MouseEvent, item: ProjectDirectoryEntry) => {
    setSelectedPath(item.path);
    setContextMenu({ x: event.clientX, y: event.clientY, entry: item });
  }, []);

  return {
    containerRef,
    tree,
    loading,
    error,
    displayTree,
    selectedPath,
    renamingPath,
    dropTargetPath,
    contextMenu,
    searchScope,
    deleteConfirm,
    isDeleting,
    previewState,
    canPaste,
    setSelectedPath,
    setRenamingPath,
    setDropTargetPath,
    setContextMenu,
    setSearchScope,
    setPreviewState,
    setDeleteConfirm,
    handleKeyDown,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleAssetsRootContextMenu,
    handleAssetsRootDragOver,
    handleAssetsRootDrop,
    handleTreeContextMenu,
    handleRenameCommit,
    openPreview,
    requestDelete,
    confirmDelete,
    handleCreateInDirectory,
    handlePasteToDirectory,
    setClipboardForEntry,
  };
}
