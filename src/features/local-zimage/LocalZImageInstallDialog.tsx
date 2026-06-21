import { LocalZImageInstallFlowPanel } from '@/features/local-zimage/LocalZImageInstallFlowPanel';
import { UiModal } from '@/components/ui';

interface LocalZImageInstallDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LocalZImageInstallDialog({
  isOpen,
  onClose,
}: LocalZImageInstallDialogProps) {
  return (
    <UiModal
      isOpen={isOpen}
      title="安装本地 Z-Image"
      onClose={onClose}
      widthClassName="w-full max-w-2xl"
    >
      <p className="mb-4 text-sm text-text-muted">
        外部科技节点需要本机 Z-Image 服务。请按顺序完成以下步骤，每一步都会单独确认。
      </p>
      <LocalZImageInstallFlowPanel compact />
    </UiModal>
  );
}
