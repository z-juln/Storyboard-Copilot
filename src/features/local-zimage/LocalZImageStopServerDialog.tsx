import { UiButton, UiModal } from '@/components/ui';

interface LocalZImageStopServerDialogProps {
  activeCount: number;
  isOpen: boolean;
  isStopping: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function LocalZImageStopServerDialog({
  activeCount,
  isOpen,
  isStopping,
  onCancel,
  onConfirm,
}: LocalZImageStopServerDialogProps) {
  return (
    <UiModal
      isOpen={isOpen}
      title="停止 Z-Image 服务"
      onClose={onCancel}
      widthClassName="w-[420px]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" disabled={isStopping} onClick={onCancel}>
            取消
          </UiButton>
          <UiButton variant="primary" size="sm" disabled={isStopping} onClick={onConfirm}>
            {isStopping ? '停止中…' : '继续停止'}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-text-dark">
        当前有
        {' '}
        <span className="font-medium text-accent">{activeCount}</span>
        {' '}
        个 Z-Image 生成任务进行中，停止服务将中断这些任务。是否继续？
      </p>
    </UiModal>
  );
}
