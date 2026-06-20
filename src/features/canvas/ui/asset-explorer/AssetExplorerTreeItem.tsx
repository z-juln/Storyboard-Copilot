import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, File, Image as ImageIcon } from 'lucide-react';

import type { ProjectDirectoryEntry } from '@/features/project/types';
import { isDescendantAssetPath } from '@/features/project/asset/assetExplorerPathUtils';
import { normalizeAssetPath } from '@/features/project/asset/assetManifest';

import { formatBytes, focusRenameInput, isImageFileName } from './formatBytes';

export interface AssetExplorerTreeItemProps {
  entry: ProjectDirectoryEntry;
  depth: number;
  selectedPaths: Set<string>;
  dropTargetPath: string | null;
  renamingPath: string | null;
  readOnly: boolean;
  onSelect: (path: string, event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent, entry: ProjectDirectoryEntry) => void;
  onRenameCommit: (entry: ProjectDirectoryEntry, nextName: string) => void;
  onRenameCancel: () => void;
  onDragStart: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onDragOver: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onDragLeave: (entry: ProjectDirectoryEntry) => void;
  onDrop: (event: DragEvent, entry: ProjectDirectoryEntry) => void;
  onOpenPreview: (entry: ProjectDirectoryEntry) => void;
  /** 选中且展开的祖先目录下，当前可见子项也应显示激活态 */
  activeDescendantOfSelection?: boolean;
}

export function AssetExplorerTreeItem({
  entry,
  depth,
  selectedPaths,
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
  activeDescendantOfSelection = false,
}: AssetExplorerTreeItemProps) {
  const isDirectory = entry.kind === 'directory';
  const [expanded, setExpanded] = useState(depth === 0);

  useEffect(() => {
    if (!renamingPath || entry.kind !== 'directory') {
      return;
    }
    if (isDescendantAssetPath(entry.path, renamingPath)) {
      setExpanded(true);
    }
  }, [entry.kind, entry.path, renamingPath]);

  const isSelected = selectedPaths.has(normalizeAssetPath(entry.path));
  const isActive = isSelected || activeDescendantOfSelection;
  const childActiveDescendantOfSelection =
    (isSelected || activeDescendantOfSelection) && isDirectory && expanded;
  const isDropTarget = dropTargetPath === entry.path && isDirectory;
  const isRenaming = renamingPath === entry.path;
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      focusRenameInput(renameInputRef.current, entry.name, entry.kind);
    }
  }, [entry.kind, entry.name, isRenaming]);

  const leadingIconClass = 'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center';

  const leadingSlot = isDirectory ? (
    <button
      type="button"
      className={leadingIconClass}
      onClick={(event) => {
        event.stopPropagation();
        setExpanded((value) => !value);
      }}
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3 text-text-muted" />
      ) : (
        <ChevronRight className="h-3 w-3 text-text-muted" />
      )}
    </button>
  ) : isImageFileName(entry.name) ? (
    <span className={leadingIconClass}>
      <ImageIcon className="h-3.5 w-3.5 text-text-muted" />
    </span>
  ) : (
    <span className={leadingIconClass}>
      <File className="h-3.5 w-3.5 text-text-muted" />
    </span>
  );

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isActive}
        draggable={!readOnly && !isRenaming}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs ${
          isActive ? 'bg-accent/15 text-accent' : 'text-text-dark hover:bg-bg-dark/70'
        } ${isDropTarget ? 'ring-1 ring-accent/60' : ''} ${isDirectory ? 'font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={(event) => onSelect(entry.path, event)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          if (entry.kind === 'file') {
            onOpenPreview(entry);
            return;
          }
          if (isDirectory) {
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
        {leadingSlot}
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
        <AssetExplorerTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          selectedPaths={selectedPaths}
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
          activeDescendantOfSelection={childActiveDescendantOfSelection}
        />
      ))}
    </div>
  );
}
