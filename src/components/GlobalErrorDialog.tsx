import { UiButton, UiModal } from '@/components/ui';
import { useCallback, useState } from 'react';

interface GlobalErrorDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  copyText?: string;
  onClose: () => void;
}

export function GlobalErrorDialog({
  isOpen,
  title,
  message,
  details,
  copyText,
  onClose,
}: GlobalErrorDialogProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    const payload = copyText || [message, details].filter(Boolean).join('\n\n');
    if (!payload) {
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error('Failed to copy global error text', error);
    }
  }, [copyText, details, message]);

  return (
    <UiModal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      widthClassName="w-[560px]"
      footer={(
        <>
          <UiButton
            variant="muted"
            size="sm"
            onClick={() => {
              void handleCopy();
            }}
          >
            {copied ? '已复制' : '复制报错信息'}
          </UiButton>
          <UiButton variant="primary" size="sm" onClick={onClose}>
            关闭
          </UiButton>
        </>
      )}
    >
      <div className="space-y-3">
        <p className="text-sm text-text-dark">{message}</p>
        {details && (
          <div className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-bg-dark/60 p-3">
            <div className="mb-2 text-xs font-medium text-text-muted">错误详情</div>
            <pre className="ui-scrollbar max-h-[280px] overflow-auto whitespace-pre-wrap break-words text-xs text-text-dark">
              {details}
            </pre>
          </div>
        )}
      </div>
    </UiModal>
  );
}
