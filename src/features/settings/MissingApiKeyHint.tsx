import { UiButton } from '@/components/ui/primitives';
import { openSettingsDialog } from './settingsEvents';

interface MissingApiKeyHintProps {
  className?: string;
}

export function MissingApiKeyHint({ className = '' }: MissingApiKeyHintProps) {
  return (
    <div className={`flex w-full justify-center ${className}`}>
      <div className="pointer-events-auto inline-flex max-w-[680px] items-center gap-3 rounded-2xl border border-accent/20 bg-surface-dark/88 px-5 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur">
        <p className="text-sm leading-7 text-text-muted sm:text-[15px]">
          您尚未配置任何密钥，请打开设置进行配置。
        </p>
        <UiButton
          type="button"
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={() => openSettingsDialog({ category: 'providers' })}
        >
          打开设置
        </UiButton>
      </div>
    </div>
  );
}
