import { memo, type SyntheticEvent } from 'react';

import type { UploadMediaKind } from '@/features/canvas/domain/canvasNodes';
import { CanvasNodeImage } from '@/features/canvas/ui/CanvasNodeImage';

interface UploadNodeMediaBodyProps {
  mediaKind: UploadMediaKind | null;
  assetMediaUrl: string;
  imageSource: string | null;
  imageViewerSourceUrl: string | null;
  textContent: string | null | undefined;
  onImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
}

export const UploadNodeMediaBody = memo(({
  mediaKind,
  assetMediaUrl,
  imageSource,
  imageViewerSourceUrl,
  textContent,
  onImageLoad,
}: UploadNodeMediaBodyProps) => (
  <div className="block h-full w-full overflow-hidden rounded-[var(--node-radius)] bg-bg-dark">
    {mediaKind === 'video' && assetMediaUrl ? (
      <video
        src={assetMediaUrl}
        controls
        className="h-full w-full object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    ) : mediaKind === 'audio' && assetMediaUrl ? (
      <div
        className="flex h-full w-full items-center justify-center px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <audio src={assetMediaUrl} controls className="w-full" />
      </div>
    ) : mediaKind === 'text' ? (
      <pre
        className="h-full w-full overflow-auto whitespace-pre-wrap break-words p-3 text-left text-[11px] leading-5 text-text-dark"
        onClick={(event) => event.stopPropagation()}
      >
        {typeof textContent === 'string' && textContent.length > 0
          ? textContent
          : '加载中…'}
      </pre>
    ) : (
      <CanvasNodeImage
        src={imageSource ?? ''}
        viewerSourceUrl={imageViewerSourceUrl}
        alt="已上传图片"
        className="h-full w-full object-contain"
        onLoad={onImageLoad}
      />
    )}
  </div>
));

UploadNodeMediaBody.displayName = 'UploadNodeMediaBody';
