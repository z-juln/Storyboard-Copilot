import { UiButton, UiModal } from '@/components/ui';

import type { DeleteConfirmState } from './types';

interface AssetExplorerDeleteDialogProps {
  state: DeleteConfirmState | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function AssetExplorerDeleteDialog({
  state,
  isDeleting,
  onCancel,
  onConfirm,
}: AssetExplorerDeleteDialogProps) {
  const entry = state?.entry;
  const refCount = state?.refCount ?? 0;

  return (
    <UiModal
      isOpen={Boolean(entry)}
      title="删除资产"
      onClose={onCancel}
      widthClassName="w-[420px]"
      footer={(
        <>
          <UiButton variant="muted" size="sm" disabled={isDeleting} onClick={onCancel}>
            取消
          </UiButton>
          <UiButton variant="primary" size="sm" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? '删除中…' : '删除'}
          </UiButton>
        </>
      )}
    >
      <p className="text-sm leading-relaxed text-text-dark">
        {refCount > 0 ? (
          <>
            「<span className="font-medium">{entry?.name}</span>」被{' '}
            <span className="font-medium text-accent">{refCount}</span> 处画布节点引用。
            删除后这些引用将失效，确定要继续吗？
          </>
        ) : (
          <>
            确定删除「<span className="font-medium">{entry?.name}</span>」吗？
            此操作不可撤销。
          </>
        )}
      </p>
    </UiModal>
  );
}
