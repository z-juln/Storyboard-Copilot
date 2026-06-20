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
  clearSystemClipboardCutMarker,
  hasSystemClipboardAssetItems,
  readProjectAssetsFromSystemClipboard,
  writeProjectAssetsToSystemClipboard,
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
import {
  entriesToSelectionItems,
  resolveTopLevelSelectedEntries,
} from '@/features/project/asset/assetExplorerSelection';
import { normalizeAssetPath } from '@/features/project/asset/assetManifest';
import {
  hasExternalFileDrop,
  resolveDropImportTargetDirectory,
  resolveExternalDropFiles,
  resolveExternalDropPaths,
  resolveInternalAssetDropPaths,
  type DragTransferEvent,
} from '@/features/project/asset/assetExplorerDropUtils';
import {
  countAssetPathRefs,
  createProjectAssetFile,
  createProjectAssetFolder,
  deleteProjectAssetEntries,
  importExternalFilesToDirectory,
  importExternalPathsToDirectory,
  moveProjectAssetEntries,
  pasteSystemClipboardToDirectory,
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
import { isTypingTarget } from '@/features/canvas/application/canvasKeyboard';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

import type { AssetPreviewState, ContextMenuState, DeleteConfirmState } from './types';
import { useAssetExplorerSelection } from './useAssetExplorerSelection';

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
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchScope, setSearchScope] = useState<{ path: string; query: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewState, setPreviewState] = useState<AssetPreviewState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragSourcePathsRef = useRef<string[]>([]);

  const {
    selectedPaths,
    anchorPath,
    selectSingle,
    togglePath,
    selectSiblingAll,
    removePaths,
    replacePaths,
  } = useAssetExplorerSelection(tree);

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

  useEffect(() => {
    const handleDragEnd = () => {
      dragSourcePathsRef.current = [];
    };
    document.addEventListener('dragend', handleDragEnd);
    return () => {
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  const displayTree = useMemo(() => {
    if (!tree) {
      return null;
    }
    if (!searchScope?.query.trim()) {
      return tree;
    }
    return filterTreeByQuery(tree, searchScope.path, searchScope.query);
  }, [searchScope, tree]);

  const getEffectiveSelectedEntries = useCallback((): ProjectDirectoryEntry[] => {
    if (!tree || selectedPaths.size === 0) {
      return [];
    }
    return resolveTopLevelSelectedEntries(tree, selectedPaths);
  }, [selectedPaths, tree]);

  const anchorEntry = useMemo(() => {
    if (!tree || !anchorPath) {
      return null;
    }
    return findEntryInTree(tree, anchorPath);
  }, [anchorPath, tree]);

  const [canPaste, setCanPaste] = useState(false);

  const refreshCanPaste = useCallback(async () => {
    if (readOnly) {
      setCanPaste(false);
      return;
    }
    setCanPaste(await hasSystemClipboardAssetItems(projectId));
  }, [projectId, readOnly]);

  useEffect(() => {
    void refreshCanPaste();
  }, [refreshCanPaste]);

  useEffect(() => {
    const handleWindowFocus = () => {
      void refreshCanPaste();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [refreshCanPaste]);

  const applyManifest = useCallback(
    (nextManifest: AssetManifest) => {
      commitAssetManifest(nextManifest);
    },
    [commitAssetManifest]
  );

  const isAssetsRootPath = useCallback(
    (path: string) => tree && normalizeAssetPath(path) === normalizeAssetPath(tree.path),
    [tree]
  );

  const setClipboardForEntries = useCallback(
    (entries: ProjectDirectoryEntry[], mode: 'copy' | 'cut') => {
      if (readOnly || entries.length === 0) {
        return;
      }
      const items = entriesToSelectionItems(entries);
      void writeProjectAssetsToSystemClipboard(
        projectId,
        items.map((item) => item.path),
        mode === 'cut'
      )
        .then(() => refreshCanPaste())
        .catch((copyError) => {
          setError(copyError instanceof Error ? copyError.message : '复制到剪贴板失败');
        });
    },
    [projectId, readOnly, refreshCanPaste]
  );

  const copySelectionToClipboard = useCallback(
    (mode: 'copy' | 'cut') => {
      const entries = getEffectiveSelectedEntries();
      if (entries.length === 0) {
        return;
      }
      setClipboardForEntries(entries, mode);
    },
    [getEffectiveSelectedEntries, setClipboardForEntries]
  );

  const handlePasteToDirectory = useCallback(
    async (targetDirPath: string) => {
      if (readOnly || !tree) {
        return;
      }
      const clipboard = await readProjectAssetsFromSystemClipboard(projectId);
      if (!clipboard.items.length) {
        setError('剪贴板中没有可粘贴的文件');
        return;
      }

      try {
        const nextManifest = await pasteSystemClipboardToDirectory({
          projectId,
          targetDirPath,
          mode: clipboard.mode,
          items: clipboard.items,
          tree,
          manifest,
        });
        applyManifest(nextManifest);
        if (clipboard.mode === 'cut') {
          await clearSystemClipboardCutMarker();
        }
        await loadTree();
        await refreshCanPaste();
      } catch (pasteError) {
        setError(pasteError instanceof Error ? pasteError.message : '粘贴失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly, refreshCanPaste, tree]
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

  const requestDeleteEntries = useCallback(
    (entries: ProjectDirectoryEntry[]) => {
      if (readOnly || entries.length === 0) {
        return;
      }
      const deletable = entries.filter((entry) => !isAssetsRootPath(entry.path));
      if (deletable.length === 0) {
        return;
      }
      const filePaths = deletable.flatMap((entry) => collectFilePathsFromEntry(entry));
      const refCount = countAssetPathRefs(manifest, nodes, filePaths);
      setDeleteConfirm({ entries: deletable, refCount });
    },
    [isAssetsRootPath, manifest, nodes, readOnly]
  );

  const requestDeleteSelection = useCallback(() => {
    requestDeleteEntries(getEffectiveSelectedEntries());
  }, [getEffectiveSelectedEntries, requestDeleteEntries]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm || isDeleting) {
      return;
    }

    const { entries } = deleteConfirm;
    setIsDeleting(true);
    try {
      const nextManifest = await deleteProjectAssetEntries({
        projectId,
        entries,
        manifest,
      });
      applyManifest(nextManifest);
      const pathsToRemove: string[] = [];
      for (const entry of entries) {
        pathsToRemove.push(entry.path);
        for (const path of selectedPaths) {
          if (isDescendantAssetPath(entry.path, path)) {
            pathsToRemove.push(path);
          }
        }
      }
      removePaths(pathsToRemove);
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
    removePaths,
    selectedPaths,
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
        selectSingle(nextPath);
        await loadTree();
      } catch (renameError) {
        setError(renameError instanceof Error ? renameError.message : '重命名失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly, selectSingle]
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
          selectSingle(path);
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
        selectSingle(created.path);
        setRenamingPath(created.path);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : '创建失败');
      }
    },
    [applyManifest, collectSiblingNames, loadTree, manifest, projectId, readOnly, selectSingle]
  );

  const handleMoveEntries = useCallback(
    async (sourcePaths: string[], targetDirPath: string) => {
      if (readOnly || sourcePaths.length === 0) {
        return;
      }

      const targetDir = normalizeAssetPath(targetDirPath).replace(/\/+$/, '') || 'assets';
      const moves: Array<{ fromPath: string; toPath: string }> = [];
      const pathMap = new Map<string, string>();

      for (const sourcePath of sourcePaths) {
        const sourceNormalized = normalizeAssetPath(sourcePath);
        if (isDescendantAssetPath(sourceNormalized, targetDir)) {
          continue;
        }

        const baseName = getAssetBaseName(sourceNormalized);
        const nextPath = joinAssetPath(targetDir, baseName);
        if (normalizeAssetPath(nextPath) === sourceNormalized) {
          continue;
        }

        moves.push({ fromPath: sourceNormalized, toPath: nextPath });
        pathMap.set(sourceNormalized, nextPath);
      }

      if (moves.length === 0) {
        return;
      }

      try {
        const nextManifest = await moveProjectAssetEntries({
          projectId,
          moves,
          manifest,
        });
        applyManifest(nextManifest);
        replacePaths(pathMap);
        await loadTree();
      } catch (moveError) {
        setError(moveError instanceof Error ? moveError.message : '移动失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly, replacePaths]
  );

  const resolvePasteTargetDir = useCallback((): string => {
    if (anchorEntry?.kind === 'directory') {
      return anchorEntry.path;
    }
    if (anchorEntry) {
      return getAssetParentPath(anchorEntry.path);
    }
    return 'assets';
  }, [anchorEntry]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const isDeleteShortcut =
        event.key === 'Delete' || (event.metaKey && event.key === 'Backspace');

      if (isDeleteShortcut) {
        if (readOnly || !tree || selectedPaths.size === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        requestDeleteSelection();
        return;
      }

      if (event.key === 'Enter') {
        if (readOnly || !tree || selectedPaths.size !== 1 || !anchorEntry) {
          return;
        }
        if (isAssetsRootPath(anchorEntry.path)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setRenamingPath(anchorEntry.path);
        return;
      }

      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'a') {
        event.preventDefault();
        event.stopPropagation();
        selectSiblingAll();
        return;
      }
      if (key === 'c') {
        event.preventDefault();
        event.stopPropagation();
        copySelectionToClipboard('copy');
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        event.stopPropagation();
        copySelectionToClipboard('cut');
        return;
      }
      if (key === 'v') {
        event.preventDefault();
        event.stopPropagation();
        void handlePasteToDirectory(resolvePasteTargetDir());
      }
    },
    [
      anchorEntry,
      copySelectionToClipboard,
      handlePasteToDirectory,
      isAssetsRootPath,
      readOnly,
      requestDeleteSelection,
      resolvePasteTargetDir,
      selectSiblingAll,
      selectedPaths.size,
      tree,
    ]
  );

  const handleSelect = useCallback(
    (path: string, event: MouseEvent) => {
      const normalized = normalizeAssetPath(path);
      if (event.metaKey || event.ctrlKey) {
        togglePath(normalized);
      } else {
        selectSingle(normalized);
      }
      containerRef.current?.focus();
    },
    [selectSingle, togglePath]
  );

  const handleImportExternalDrop = useCallback(
    async (event: DragTransferEvent, targetDirPath: string) => {
      if (readOnly) {
        return;
      }

      try {
        const absolutePaths = resolveExternalDropPaths(event);
        if (absolutePaths.length > 0) {
          const nextManifest = await importExternalPathsToDirectory({
            projectId,
            targetDirPath,
            absolutePaths,
            manifest,
          });
          applyManifest(nextManifest);
          await loadTree();
          return;
        }

        const files = resolveExternalDropFiles(event);
        if (files.length > 0) {
          const nextManifest = await importExternalFilesToDirectory({
            projectId,
            targetDirPath,
            files,
            manifest,
          });
          applyManifest(nextManifest);
          await loadTree();
          return;
        }

        setError('无法读取拖放的文件，请尝试复制后粘贴');
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : '导入外部文件失败');
      }
    },
    [applyManifest, loadTree, manifest, projectId, readOnly]
  );

  const handleDragStart = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      if (readOnly) {
        event.preventDefault();
        return;
      }

      const normalizedEntryPath = normalizeAssetPath(entry.path);
      const isMultiDrag =
        tree
        && selectedPaths.has(normalizedEntryPath)
        && selectedPaths.size > 1;
      const sourcePaths = isMultiDrag
        ? resolveTopLevelSelectedEntries(tree, selectedPaths).map((item) => item.path)
        : [entry.path];

      dragSourcePathsRef.current = sourcePaths;

      if (!selectedPaths.has(normalizedEntryPath)) {
        selectSingle(normalizedEntryPath);
      }

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
    [readOnly, selectSingle, selectedPaths, tree]
  );

  const handleDragOver = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      if (readOnly) {
        return;
      }

      const isExternal = hasExternalFileDrop(event);
      if (entry.kind !== 'directory' && !isExternal) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = isExternal ? 'copy' : 'move';
      setDropTargetPath(resolveDropImportTargetDirectory(entry));
    },
    [readOnly]
  );

  const handleDrop = useCallback(
    (event: DragEvent, entry: ProjectDirectoryEntry) => {
      event.preventDefault();
      event.stopPropagation();
      setDropTargetPath(null);
      if (readOnly) {
        return;
      }

      const targetDirPath = resolveDropImportTargetDirectory(entry);
      const externalPaths = resolveExternalDropPaths(event);
      const externalFiles = resolveExternalDropFiles(event);

      if (externalPaths.length > 0 || externalFiles.length > 0 || hasExternalFileDrop(event)) {
        dragSourcePathsRef.current = [];
        void handleImportExternalDrop(event, targetDirPath);
        return;
      }

      if (entry.kind !== 'directory') {
        return;
      }

      const sourcePaths = resolveInternalAssetDropPaths(event, dragSourcePathsRef.current);
      if (sourcePaths.length === 0) {
        return;
      }

      void handleMoveEntries(sourcePaths, targetDirPath);
      dragSourcePathsRef.current = [];
    },
    [handleImportExternalDrop, handleMoveEntries, readOnly]
  );

  const handleAssetsRootContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!tree) {
        return;
      }
      event.preventDefault();
      selectSingle(tree.path);
      void refreshCanPaste();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        entry: tree,
        isAssetsRoot: true,
      });
    },
    [refreshCanPaste, selectSingle, tree]
  );

  const handleAssetsRootDragOver = useCallback(
    (event: DragEvent) => {
      if (readOnly || !tree) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = hasExternalFileDrop(event) ? 'copy' : 'move';
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

  const handleTreeContextMenu = useCallback(
    (event: MouseEvent, item: ProjectDirectoryEntry) => {
      const normalized = normalizeAssetPath(item.path);
      if (!selectedPaths.has(normalized)) {
        selectSingle(normalized);
      }
      void refreshCanPaste();
      setContextMenu({ x: event.clientX, y: event.clientY, entry: item });
    },
    [refreshCanPaste, selectSingle, selectedPaths]
  );

  const copyContextMenuSelection = useCallback(
    (mode: 'copy' | 'cut') => {
      if (!tree) {
        return;
      }
      const normalized = normalizeAssetPath(contextMenu?.entry.path ?? '');
      const entries = selectedPaths.has(normalized)
        ? resolveTopLevelSelectedEntries(tree, selectedPaths)
        : contextMenu?.entry
          ? [contextMenu.entry]
          : [];
      setClipboardForEntries(entries, mode);
    },
    [contextMenu, selectedPaths, setClipboardForEntries, tree]
  );

  const deleteContextMenuSelection = useCallback(() => {
    if (!tree) {
      return;
    }
    const normalized = normalizeAssetPath(contextMenu?.entry.path ?? '');
    const entries = selectedPaths.has(normalized)
      ? resolveTopLevelSelectedEntries(tree, selectedPaths)
      : contextMenu?.entry
        ? [contextMenu.entry]
        : [];
    requestDeleteEntries(entries);
  }, [contextMenu, requestDeleteEntries, selectedPaths, tree]);

  return {
    containerRef,
    tree,
    loading,
    error,
    displayTree,
    selectedPaths,
    renamingPath,
    dropTargetPath,
    contextMenu,
    searchScope,
    deleteConfirm,
    isDeleting,
    previewState,
    canPaste,
    selectSingle,
    setRenamingPath,
    setDropTargetPath,
    setContextMenu,
    setSearchScope,
    setPreviewState,
    setDeleteConfirm,
    handleKeyDown,
    handleSelect,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleAssetsRootContextMenu,
    handleAssetsRootDragOver,
    handleAssetsRootDrop,
    handleTreeContextMenu,
    handleRenameCommit,
    openPreview,
    requestDeleteSelection,
    confirmDelete,
    handleCreateInDirectory,
    handlePasteToDirectory,
    copyContextMenuSelection,
    deleteContextMenuSelection,
  };
}
