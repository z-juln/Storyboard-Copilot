import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { isAssetPreviewable } from '@/features/project/asset/assetPreviewUtils';
import { resolveReplaceableAssetKind } from '@/features/project/asset/assetReplaceUtils';

import type { ContextMenuState } from './types';

interface AssetExplorerContextMenuProps {
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
  onReplace: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFindInFolder: () => void;
}

export function AssetExplorerContextMenu({
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
  onReplace,
  onRename,
  onDelete,
  onFindInFolder,
}: AssetExplorerContextMenuProps) {
  const isDirectory = state.entry.kind === 'directory';
  const isAssetsRoot = state.isAssetsRoot === true;
  const canPreview = !isDirectory && isAssetPreviewable(state.entry.name);
  const canReplace = !isDirectory && resolveReplaceableAssetKind(state.entry.name) !== null;

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
  { label: '替换文件…', action: onReplace, hidden: isDirectory || !canReplace, disabled: readOnly },
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
