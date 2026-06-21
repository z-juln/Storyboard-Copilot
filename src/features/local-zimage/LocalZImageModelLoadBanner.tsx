import { Loader2 } from 'lucide-react';

import type { LocalZImageStatus } from '@/features/canvas/external-tech/types';
import { UiButton } from '@/components/ui';

interface LocalZImageModelLoadBannerProps {
  status: LocalZImageStatus;
  onWarmup?: () => void;
  warmupDisabled?: boolean;
}

export function isLocalZImageFullyReady(status: LocalZImageStatus | null): boolean {
  return Boolean(status?.installed && status.server_running && status.model_loaded);
}

export function LocalZImageModelLoadBanner({
  status,
  onWarmup,
  warmupDisabled = false,
}: LocalZImageModelLoadBannerProps) {
  if (!status.server_running) {
    return null;
  }

  if (status.model_loaded) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
        模型已加载完成，可直接生成。
      </div>
    );
  }

  if (status.model_loading) {
    const progress = Math.round(status.model_progress ?? 0);
    return (
      <div className="space-y-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-text-dark">
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
          <span>{status.model_phase || '正在加载模型…'}</span>
          <span className="ml-auto tabular-nums text-accent">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border-dark">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(progress, 4)}%` }}
          />
        </div>
        <p className="text-[11px] text-text-muted">
          首次加载约 2–5 分钟，取决于磁盘与内存。加载完成后首次生成会更快。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
      <span>{status.model_phase || '服务已启动，模型尚未加载'}</span>
      {onWarmup ? (
        <UiButton size="sm" variant="muted" disabled={warmupDisabled} onClick={onWarmup}>
          预加载模型
        </UiButton>
      ) : null}
    </div>
  );
}
