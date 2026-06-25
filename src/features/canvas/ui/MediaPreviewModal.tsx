import { memo, type ReactNode } from 'react';

import { UiButton, UiModal } from '@/components/ui';
import { MediaPreviewBody } from '@/features/canvas/ui/MediaPreviewBody';
import type { MediaPreviewKind } from '@/features/canvas/ui/mediaPreviewShared';
import {
  FULLSCREEN_MODAL_BODY_CLASS,
  FULLSCREEN_MODAL_PANEL_CLASS,
} from '@/features/canvas/ui/fullscreenModalLayout';

interface MediaPreviewModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  kind: Exclude<MediaPreviewKind, 'image'>;
  mediaUrl?: string;
  textContent?: string;
  autoPlayVideo?: boolean;
  footer?: ReactNode;
}

export const MediaPreviewModal = memo(({
  isOpen,
  title,
  onClose,
  kind,
  mediaUrl = '',
  textContent = '',
  autoPlayVideo = false,
  footer,
}: MediaPreviewModalProps) => {
  const resolvedMediaUrl = kind === 'text' ? '' : mediaUrl;

  return (
    <UiModal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      widthClassName={FULLSCREEN_MODAL_PANEL_CLASS}
      bodyClassName={FULLSCREEN_MODAL_BODY_CLASS}
      footer={footer ?? (
        <UiButton variant="primary" size="sm" onClick={onClose}>
          关闭
        </UiButton>
      )}
    >
      <MediaPreviewBody
        kind={kind}
        mediaUrl={resolvedMediaUrl}
        textContent={textContent}
        autoPlayVideo={autoPlayVideo}
      />
    </UiModal>
  );
});

MediaPreviewModal.displayName = 'MediaPreviewModal';
