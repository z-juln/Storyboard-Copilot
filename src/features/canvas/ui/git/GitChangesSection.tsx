import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ProjectGitChange } from '@/features/git/types';

import { canDiffGitChange } from './gitDiffUtils';
import { GitChangeRow } from './GitChangeRow';

interface GitChangesSectionProps {
  changes: ProjectGitChange[];
  readOnly: boolean;
  busy: boolean;
  headCommit: string | null | undefined;
  onOpen: (change: ProjectGitChange) => void;
  onDiff: (change: ProjectGitChange) => void;
  onRevert: (change: ProjectGitChange) => void;
  canOpenChange: (change: ProjectGitChange) => boolean;
}

export const GitChangesSection = memo(({
  changes,
  readOnly,
  busy,
  headCommit,
  onOpen,
  onDiff,
  onRevert,
  canOpenChange,
}: GitChangesSectionProps) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <section>
      <div className="mb-0.5 flex items-center gap-1 px-1">
        <button
          type="button"
          className="inline-flex min-w-0 flex-1 items-center gap-1 rounded py-0.5 text-left text-xs font-medium text-text-dark hover:bg-bg-dark/50"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          )}
          <span>更改</span>
          {changes.length > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
              {changes.length}
            </span>
          ) : null}
        </button>
      </div>

      {expanded ? (
        changes.length === 0 ? (
          <div className="px-2 py-1 text-xs text-text-muted">暂无未提交变更</div>
        ) : (
          <div className="min-w-0">
            {changes.map((change) => (
              <GitChangeRow
                key={`${change.kind}-${change.path}`}
                change={change}
                readOnly={readOnly}
                busy={busy}
                canDiff={canDiffGitChange(change, headCommit)}
                canOpen={canOpenChange(change)}
                onOpen={onOpen}
                onDiff={onDiff}
                onRevert={onRevert}
              />
            ))}
          </div>
        )
      ) : null}
    </section>
  );
});

GitChangesSection.displayName = 'GitChangesSection';
