import { memo } from 'react';

import {
  PREVIEW_MEDIA_FRAME_CLASS,
  PREVIEW_TEXT_READONLY_CLASS,
  type MediaPreviewKind,
} from '@/features/canvas/ui/mediaPreviewShared';

interface MediaPreviewBodyProps {
  kind: Exclude<MediaPreviewKind, 'image'>;
  mediaUrl: string;
  textContent?: string;
  autoPlayVideo?: boolean;
}

export const MediaPreviewBody = memo(({
  kind,
  mediaUrl,
  textContent,
  autoPlayVideo = false,
}: MediaPreviewBodyProps) => {
  if (kind === 'video') {
    return (
      <div className={PREVIEW_MEDIA_FRAME_CLASS}>
        <video
          src={mediaUrl}
          controls
          autoPlay={autoPlayVideo}
          playsInline
          className="max-h-full max-w-full rounded-lg bg-black object-contain"
        />
      </div>
    );
  }

  if (kind === 'audio') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border-dark bg-bg-dark/30 px-4 py-6">
        <audio src={mediaUrl} controls autoPlay={autoPlayVideo} className="w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-dark bg-bg-dark/30">
      <pre className={PREVIEW_TEXT_READONLY_CLASS}>
        {textContent && textContent.length > 0 ? textContent : '（空文件）'}
      </pre>
    </div>
  );
});

MediaPreviewBody.displayName = 'MediaPreviewBody';
