import { X } from 'lucide-react';

import { UiButton } from '@/components/ui';
import { LocalZImageInstallFlowPanel } from '@/features/local-zimage/LocalZImageInstallFlowPanel';
import {
  isLocalZImageFullyReady,
  LocalZImageModelLoadBanner,
} from '@/features/local-zimage/LocalZImageModelLoadBanner';
import { useLocalZImageInstallFlow } from '@/features/local-zimage/useLocalZImageInstallFlow';
import { useSettingsStore } from '@/stores/settingsStore';

export function LocalZImageHomePanel() {
  const hideLocalZImageHomePanel = useSettingsStore((state) => state.hideLocalZImageHomePanel);
  const setHideLocalZImageHomePanel = useSettingsStore((state) => state.setHideLocalZImageHomePanel);
  const { status, stopServer, warmupModel } = useLocalZImageInstallFlow();
  const allReady = isLocalZImageFullyReady(status);

  if (hideLocalZImageHomePanel) {
    return null;
  }

  return (
    <div className="mb-8 rounded-xl border border-accent/20 bg-accent/5 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-dark">外部科技 · 本地 Z-Image</h2>
          <p className="mt-1 text-xs text-text-muted">
            使用外部科技节点前，请按步骤完成本地安装。每一步都会单独确认，可随时在设置中查看详情。
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-bg-dark hover:text-text-dark"
          aria-label="隐藏面板"
          onClick={() => setHideLocalZImageHomePanel(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
        {status?.server_detached ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <span>
              检测到上次未关闭的 Z-Image 服务，模型可能仍在内存中。不需要时可手动停止。
            </span>
            <UiButton
              size="sm"
              variant="muted"
              onClick={() => {
                void stopServer();
              }}
            >
              停止遗留服务
            </UiButton>
          </div>
        ) : null}
        {allReady ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <span>本地 Z-Image 已就绪（{status?.server_url}），模型已加载，可在外部科技节点中直接生成。</span>
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 text-emerald-100 transition-colors hover:bg-emerald-500/20"
              onClick={() => setHideLocalZImageHomePanel(true)}
            >
              知道了
            </button>
          </div>
        ) : null}
        {status?.server_running && !status.model_loaded ? (
          <div className="mb-3">
            <LocalZImageModelLoadBanner
              status={status}
              onWarmup={() => {
                void warmupModel();
              }}
            />
          </div>
        ) : null}
        <LocalZImageInstallFlowPanel compact />
    </div>
  );
}
