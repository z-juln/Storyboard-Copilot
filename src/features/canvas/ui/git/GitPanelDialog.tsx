import { UiButton, UiModal } from '@/components/ui';

export type GitPanelDialogState =
  | {
      kind: 'alert';
      title: string;
      message: string;
    }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      cancelLabel?: string;
    };

interface GitPanelDialogProps {
  state: GitPanelDialogState | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}

export function GitPanelDialog({
  state,
  busy = false,
  onClose,
  onConfirm,
}: GitPanelDialogProps) {
  if (!state) {
    return null;
  }

  const isConfirm = state.kind === 'confirm';

  return (
    <UiModal
      isOpen
      title={state.title}
      onClose={busy ? () => undefined : onClose}
      widthClassName="w-[min(420px,calc(100vw-2rem))]"
      footer={(
        <>
          {isConfirm ? (
            <UiButton variant="muted" size="sm" disabled={busy} onClick={onClose}>
              {state.cancelLabel ?? '取消'}
            </UiButton>
          ) : null}
          <UiButton
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (isConfirm) {
                onConfirm?.();
                return;
              }
              onClose();
            }}
          >
            {isConfirm ? (busy ? '处理中…' : state.confirmLabel) : '知道了'}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-text-dark">{state.message}</p>
    </UiModal>
  );
}
