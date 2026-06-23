import { memo, type ReactNode } from 'react';
import { ExternalLink, GitCompare, Undo2 } from 'lucide-react';

import type { ProjectGitChange } from '@/features/git/types';
import {
  formatGitChangeKind,
  gitChangeStatusClassName,
  gitChangeStatusLetter,
} from '@/features/git/gitFormatters';

import { resolveGitFileIcon, resolveGitFileIconClassName } from './gitFileIcon';
import { splitGitChangePath, truncateGitParentPath } from './gitPathUtils';

interface GitChangeRowProps {
  change: ProjectGitChange;
  readOnly: boolean;
  busy: boolean;
  canDiff: boolean;
  canOpen: boolean;
  onOpen: (change: ProjectGitChange) => void;
  onDiff: (change: ProjectGitChange) => void;
  onRevert: (change: ProjectGitChange) => void;
}

function RowActionButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-dark hover:text-text-dark disabled:cursor-not-allowed disabled:opacity-40"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export const GitChangeRow = memo(({
  change,
  readOnly,
  busy,
  canDiff,
  canOpen,
  onOpen,
  onDiff,
  onRevert,
}: GitChangeRowProps) => {
  const { fileName, parentPath } = splitGitChangePath(change.path);
  const Icon = resolveGitFileIcon(fileName);
  const iconClassName = resolveGitFileIconClassName(fileName);
  const statusLetter = gitChangeStatusLetter(change.kind);
  const statusClassName = gitChangeStatusClassName(change.kind);
  const showActions = !readOnly && !busy;

  return (
    <div
      className={`group flex h-7 min-w-0 items-center gap-1 rounded px-1 hover:bg-bg-dark/60 ${canDiff ? 'cursor-pointer' : ''}`}
      title={`${formatGitChangeKind(change.kind)} · ${change.path}${canDiff ? ' · 双击对比' : ''}`}
      onDoubleClick={() => {
        if (canDiff) {
          onDiff(change);
        }
      }}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClassName}`} />
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        <span className="min-w-0 truncate text-xs text-text-dark">{fileName}</span>
        {parentPath ? (
          <span
            className="max-w-[2.75rem] shrink truncate text-[11px] text-text-muted"
            title={parentPath}
          >
            {truncateGitParentPath(parentPath)}
          </span>
        ) : null}
        {change.oldPath ? (
          <span
            className="max-w-[2.5rem] shrink truncate text-[10px] text-text-muted/80"
            title={`${change.oldPath} → ${change.path}`}
          >
            ← {splitGitChangePath(change.oldPath).fileName}
          </span>
        ) : null}
      </div>

      <div
        className={`flex shrink-0 items-center justify-end gap-0.5 transition-[width] duration-150 ${
          showActions ? 'w-4 group-hover:w-[4.75rem]' : 'w-4'
        }`}
      >
        {showActions ? (
          <div className="flex max-w-0 items-center gap-0.5 overflow-hidden opacity-0 transition-all duration-150 group-hover:max-w-[3.75rem] group-hover:opacity-100">
            {canOpen ? (
              <RowActionButton title="打开" disabled={busy} onClick={() => onOpen(change)}>
                <ExternalLink className="h-3 w-3" />
              </RowActionButton>
            ) : null}
            {canDiff ? (
              <RowActionButton title="对比" disabled={busy} onClick={() => onDiff(change)}>
                <GitCompare className="h-3 w-3" />
              </RowActionButton>
            ) : null}
            <RowActionButton title="撤销" disabled={busy} onClick={() => onRevert(change)}>
              <Undo2 className="h-3 w-3" />
            </RowActionButton>
          </div>
        ) : null}
        <span className={`w-4 shrink-0 text-right text-[11px] font-semibold leading-none ${statusClassName}`}>
          {statusLetter}
        </span>
      </div>
    </div>
  );
});

GitChangeRow.displayName = 'GitChangeRow';
