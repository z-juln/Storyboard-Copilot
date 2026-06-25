import { memo, type SyntheticEvent } from 'react';

import type { UploadMediaKind } from '@/features/canvas/domain/canvasNodes';
import { CanvasNodeImage } from '@/features/canvas/ui/CanvasNodeImage';
import { CanvasNodeVideo } from '@/features/canvas/ui/CanvasNodeVideo';
import { CanvasNodeAudio } from '@/features/canvas/ui/CanvasNodeAudio';
import { NodeAssetUnavailableNotice } from '@/features/canvas/ui/NodeAssetUnavailableNotice';
import {
  PROJECT_ASSET_UNAVAILABLE_MESSAGE,
  useIsProjectAssetUnavailable,
  type ProjectAssetBinding,
} from '@/features/project/asset';

interface UploadNodeMediaBodyProps {
  mediaKind: UploadMediaKind | null;
  assetBinding: ProjectAssetBinding;
  assetMediaUrl: string;
  imageSource: string | null;
  imageViewerSourceUrl: string | null;
  textContent: string | null | undefined;
  onImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
  nodeSelected?: boolean;
}

export const UploadNodeMediaBody = memo(({
  mediaKind,
  assetBinding,
  assetMediaUrl,
  imageSource,
  imageViewerSourceUrl,
  textContent,
  onImageLoad,
  nodeSelected,
}: UploadNodeMediaBodyProps) => {
  const isAssetUnavailable = useIsProjectAssetUnavailable(assetBinding);
  const isNonImageMedia = mediaKind === 'video' || mediaKind === 'audio' || mediaKind === 'text';

  return (
    <div className="block h-full w-full overflow-hidden rounded-[var(--node-radius)] bg-bg-dark">
      {isAssetUnavailable && isNonImageMedia ? (
        <NodeAssetUnavailableNotice message={PROJECT_ASSET_UNAVAILABLE_MESSAGE} />
      ) : mediaKind === 'video' && assetMediaUrl ? (
        <CanvasNodeVideo src={assetMediaUrl} selected={nodeSelected} />
      ) : mediaKind === 'audio' && assetMediaUrl ? (
        <CanvasNodeAudio src={assetMediaUrl} selected={nodeSelected} />
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
          assetBinding={assetBinding}
          src={imageSource ?? ''}
          viewerSourceUrl={imageViewerSourceUrl}
          alt="已上传图片"
          className="h-full w-full object-contain"
          onLoad={onImageLoad}
        />
      )}
    </div>
  );
});

UploadNodeMediaBody.displayName = 'UploadNodeMediaBody';
