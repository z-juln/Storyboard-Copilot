import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsCheckboxCard } from '../SettingsCheckboxCard';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface AboutSettingsPanelProps {
  state: SettingsDialogState;
  onClose: () => void;
}

export function AboutSettingsPanel({ state, onClose }: AboutSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="关于"
      description="应用信息"
      onSave={state.handleSave}
      footer={(
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border-dark px-4 py-2 text-sm font-medium text-text-dark transition-colors hover:bg-bg-dark"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={state.handleSave}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80"
          >
            保存
          </button>
        </div>
      )}
    >
      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <div className="flex items-start gap-4">
          <img
            src="/app-icon.png"
            alt="Video-Copilot"
            className="h-14 w-14 rounded-lg border border-border-dark object-cover"
          />
          <div className="min-w-0 flex-1">
            <a
              href="https://space.bilibili.com/39337803"
              target="_blank"
              rel="noreferrer"
              className="text-base font-semibold text-accent hover:underline"
            >
              Video-Copilot
            </a>
            <p className="mt-1 text-sm text-text-muted">
              基于节点画布的 AI 分镜工作台，一站式完成图片生成、编辑与分镜流程。
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-border-dark bg-bg-dark p-4 text-sm">
        <p className="text-text-dark">
          版本: <span className="text-text-muted">{state.appVersion || '未知'}</span>
        </p>
        <p className="text-text-dark">
          作者:{' '}
          <a
            href="https://space.bilibili.com/39337803"
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            痕继痕迹
          </a>
        </p>
        <p className="text-text-dark">
          项目仓库:{' '}
          <a
            href="https://github.com/z-juln/Video-Copilot"
            target="_blank"
            rel="noreferrer"
            className="break-all text-accent hover:underline"
          >
            https://github.com/z-juln/Video-Copilot
          </a>
        </p>
      </div>

      <div className="space-y-3">
        <SettingsCheckboxCard
          checked={state.localAutoCheckAppUpdateOnLaunch}
          onCheckedChange={state.setLocalAutoCheckAppUpdateOnLaunch}
          title="启动时自动检查更新"
          description="每次打开软件自动检查一次新版本。"
        />
        <SettingsCheckboxCard
          checked={state.localEnableUpdateDialog}
          onCheckedChange={state.setLocalEnableUpdateDialog}
          title="启用更新提示弹窗"
          description="检测到新版本时显示更新提示弹窗。"
        />
        <div className="pt-1">
          <button
            type="button"
            onClick={() => {
              void state.handleCheckUpdate();
            }}
            className="rounded border border-border-dark bg-surface-dark px-3 py-2 text-sm text-text-dark transition-colors hover:bg-bg-dark disabled:cursor-not-allowed disabled:opacity-50"
            disabled={state.checkUpdateStatus === 'checking'}
          >
            {state.checkUpdateStatus === 'checking' ? '正在检查更新...' : '立即检查更新'}
          </button>
          {state.checkUpdateStatus !== '' ? (
            <p className="mt-2 text-xs text-text-muted">
              {state.checkUpdateStatus === 'has-update' && '检测到新版本。'}
              {state.checkUpdateStatus === 'up-to-date' && '当前已是最新版本。'}
              {state.checkUpdateStatus === 'failed' && '检查更新失败，请稍后重试。'}
              {state.checkUpdateStatus === 'checking' && '正在检查更新...'}
            </p>
          ) : null}
        </div>
      </div>
    </SettingsPanelShell>
  );
}
