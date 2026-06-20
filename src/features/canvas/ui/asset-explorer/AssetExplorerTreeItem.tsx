import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Image as ImageIcon } from 'lucide-react';

import type { ProjectDirectoryEntry } from '@/features/project/types';
import { isDescendantAssetPath } from '@/features/project/asset/assetExplorerPathUtils';

import { formatBytes, focusRenameInput, isImageFileName } from './formatBytes';

export interface AssetExplorerTreeItemProps {
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

export function AssetExplorerTreeItem({
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
}: AssetExplorerTreeItemProps) {
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
    if (isRenaming && renameInputRef.current) {
      focusRenameInput(renameInputRef.current, entry.name, entry.kind);
    }
  }, [entry.kind, entry.name, isRenaming]);

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
        <AssetExplorerTreeItem
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
