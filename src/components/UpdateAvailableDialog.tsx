import { useCallback, useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { UiButton, UiModal, UiSelect } from '@/components/ui';

const GITHUB_RELEASES_URL = 'https://github.com/z-juln/Video-Copilot/releases';
export type UpdateIgnoreMode = 'today-version' | 'forever-version' | 'forever-all';

interface UpdateAvailableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  latestVersion?: string;
  currentVersion?: string;
  onApplyIgnore?: (mode: UpdateIgnoreMode) => void;
}

export function UpdateAvailableDialog({
  isOpen,
  onClose,
  latestVersion,
  currentVersion,
  onApplyIgnore,
}: UpdateAvailableDialogProps) {
  const [ignoreMode, setIgnoreMode] = useState<UpdateIgnoreMode>('today-version');

  const ignoreOptions = useMemo(
    () => [
      { value: 'today-version' as const, label: '今日不再提示该版本' },
      { value: 'forever-version' as const, label: '不再提示该版本' },
      { value: 'forever-all' as const, label: '永远不再提示更新' },
    ],
    []
  );

  const handleOpenGithub = useCallback(() => {
    void openUrl(GITHUB_RELEASES_URL);
  }, []);

  const handleApplyIgnore = useCallback(() => {
    onApplyIgnore?.(ignoreMode);
    onClose();
  }, [ignoreMode, onApplyIgnore, onClose]);

  return (
    <UiModal
      isOpen={isOpen}
      onClose={onClose}
      title="发现新版本"
      footer={(
        <>
          <UiButton variant="muted" onClick={onClose}>
            取消
          </UiButton>
          <UiButton variant="primary" onClick={handleOpenGithub}>
            去 GitHub 下载
          </UiButton>
          <UiButton variant="ghost" onClick={handleApplyIgnore}>
            应用忽略
          </UiButton>
        </>
      )}
    >
      <div className="text-sm text-text-muted leading-6">
        <p>检测到软件有新版本，是否前往下载？</p>
        {(latestVersion || currentVersion) && (
          <p className="mt-2 text-xs">
            {`当前版本：${currentVersion ?? '-'}，最新版本：${latestVersion ?? '-'}`}
          </p>
        )}
        <div className="mt-3">
          <p className="mb-1 text-xs text-text-muted">忽略提醒规则</p>
          <UiSelect
            value={ignoreMode}
            onChange={(event) => setIgnoreMode(event.target.value as UpdateIgnoreMode)}
            className="h-9 text-sm"
          >
            {ignoreOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </UiSelect>
        </div>
      </div>
    </UiModal>
  );
}
