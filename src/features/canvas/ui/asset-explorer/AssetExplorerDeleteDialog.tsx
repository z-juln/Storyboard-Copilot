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
  const entries = state?.entries ?? [];
  const refCount = state?.refCount ?? 0;
  const isBatch = entries.length > 1;
  const primaryName = entries[0]?.name ?? '';

  return (
    <UiModal
      isOpen={entries.length > 0}
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
          isBatch ? (
            <>
              选中的 <span className="font-medium">{entries.length}</span> 项资产被{' '}
              <span className="font-medium text-accent">{refCount}</span> 处画布节点引用。
              删除后这些引用将失效，确定要继续吗？
            </>
          ) : (
            <>
              「<span className="font-medium">{primaryName}</span>」被{' '}
              <span className="font-medium text-accent">{refCount}</span> 处画布节点引用。
              删除后这些引用将失效，确定要继续吗？
            </>
          )
        ) : isBatch ? (
          <>
            确定删除选中的 <span className="font-medium">{entries.length}</span> 项资产吗？
            此操作不可撤销。
          </>
        ) : (
          <>
            确定删除「<span className="font-medium">{primaryName}</span>」吗？
            此操作不可撤销。
          </>
        )}
      </p>
    </UiModal>
  );
}
