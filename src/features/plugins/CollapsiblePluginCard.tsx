import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type PluginStatusVariant = 'ready' | 'warning' | 'idle';

interface CollapsiblePluginCardProps {
  title: string;
  description: string;
  statusLabel?: string;
  statusVariant?: PluginStatusVariant;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function statusClassName(variant: PluginStatusVariant): string {
  switch (variant) {
    case 'ready':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
    default:
      return 'border-border-dark bg-bg-dark/60 text-text-muted';
  }
}

export function CollapsiblePluginCard({
  title,
  description,
  statusLabel,
  statusVariant = 'idle',
  defaultExpanded = false,
  children,
}: CollapsiblePluginCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="overflow-hidden rounded-xl border border-border-dark bg-surface-dark">
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-dark/40"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-text-muted">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-text-dark">{title}</span>
            {statusLabel ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClassName(statusVariant)}`}
              >
                {statusLabel}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-xs text-text-muted">{description}</span>
        </span>
      </button>
      {expanded ? (
        <div className="ui-scrollbar max-h-[min(52vh,28rem)] overflow-y-auto border-t border-border-dark px-4 py-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
