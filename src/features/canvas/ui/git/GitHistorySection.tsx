import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { ProjectGitCommit } from '@/features/git/types';
import { formatCommitTime } from '@/features/git/gitFormatters';
import { UiChipButton } from '@/components/ui/primitives';

interface GitHistorySectionProps {
  commits: ProjectGitCommit[];
  headHash: string | null | undefined;
  readOnly: boolean;
  busy: boolean;
  onCheckout: (hash: string) => void;
  onKeepCurrent: () => void;
}

export const GitHistorySection = memo(({
  commits,
  headHash,
  readOnly,
  busy,
  onCheckout,
  onKeepCurrent,
}: GitHistorySectionProps) => {
  const [expanded, setExpanded] = useState(true);
  const canKeepCurrent = commits.length > 1;

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
          <span>历史版本</span>
          {commits.length > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bg-dark px-1 text-[10px] font-medium text-text-muted">
              {commits.length}
            </span>
          ) : null}
        </button>
        {!readOnly && canKeepCurrent ? (
          <UiChipButton
            type="button"
            className="h-6 shrink-0 px-2 text-[10px]"
            disabled={busy}
            onClick={onKeepCurrent}
          >
            仅保留当前版本
          </UiChipButton>
        ) : null}
      </div>

      {expanded ? (
        commits.length === 0 ? (
          <div className="px-2 py-1 text-xs text-text-muted">尚无提交记录</div>
        ) : (
          <div className="min-w-0">
            {commits.map((item, index) => {
              const isHead = headHash === item.hash;
              return (
                <div
                  key={item.hash}
                  className="group flex min-h-[1.75rem] items-center gap-2 rounded px-1 py-0.5 hover:bg-bg-dark/60"
                >
                  <span className="shrink-0 font-mono text-[11px] text-text-dark">{item.shortHash}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-text-dark/90" title={item.message}>
                    {item.message || '（无说明）'}
                  </span>
                  <span className="shrink-0 text-[10px] text-text-muted">
                    {formatCommitTime(item.committedAt)}
                  </span>
                  <span className="shrink-0 text-[10px] text-text-muted">
                    #
                    {commits.length - index}
                  </span>
                  {isHead ? (
                    <span className="shrink-0 text-[10px] text-accent">当前</span>
                  ) : !readOnly ? (
                    <UiChipButton
                      type="button"
                      className="h-6 shrink-0 px-2 text-[10px] opacity-0 transition-opacity group-hover:opacity-100"
                      disabled={busy}
                      onClick={() => onCheckout(item.hash)}
                    >
                      切换
                    </UiChipButton>
                  ) : null}
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
});

GitHistorySection.displayName = 'GitHistorySection';
