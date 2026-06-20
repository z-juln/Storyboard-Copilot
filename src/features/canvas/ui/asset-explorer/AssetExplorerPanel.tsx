import { memo } from 'react';
import { Search, X } from 'lucide-react';

import { UiInput } from '@/components/ui';
import { getAssetBaseName } from '@/features/project/asset/assetExplorerPathUtils';
import { hasExternalFileDrop } from '@/features/project/asset/assetExplorerDropUtils';

import { AssetPreviewDialog } from '../AssetPreviewDialog';
import { AssetExplorerContextMenu } from './AssetExplorerContextMenu';
import { AssetExplorerDeleteDialog } from './AssetExplorerDeleteDialog';
import { AssetExplorerTreeItem } from './AssetExplorerTreeItem';
import { useAssetExplorerController } from './useAssetExplorerController';
import type { AssetExplorerPanelProps } from './types';

export const AssetExplorerPanel = memo(({ projectId, readOnly = false }: AssetExplorerPanelProps) => {
  const controller = useAssetExplorerController({ projectId, readOnly });

  const {
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
    confirmDelete,
    handleCreateInDirectory,
    handlePasteToDirectory,
    copyContextMenuSelection,
    deleteContextMenuSelection,
  } = controller;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-asset-explorer-root
      className="min-h-[12rem] outline-none"
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
      onDragOver={(event) => {
        if (readOnly || !hasExternalFileDrop(event)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
      }}
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
            <AssetExplorerTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              selectedPaths={selectedPaths}
              dropTargetPath={dropTargetPath}
              renamingPath={renamingPath}
              readOnly={readOnly}
              onSelect={handleSelect}
              onContextMenu={handleTreeContextMenu}
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
              selectSingle(tree.path);
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
          onCopy={() => copyContextMenuSelection('copy')}
          onCut={() => copyContextMenuSelection('cut')}
          onPaste={() => {
            if (contextMenu.entry.kind === 'directory') {
              void handlePasteToDirectory(contextMenu.entry.path);
            }
          }}
          onPreview={() => {
            openPreview(contextMenu.entry);
          }}
          onRename={() => setRenamingPath(contextMenu.entry.path)}
          onDelete={() => deleteContextMenuSelection()}
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
