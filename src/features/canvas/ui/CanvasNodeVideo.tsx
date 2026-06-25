import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Play } from 'lucide-react';

import { MediaPreviewModal } from '@/features/canvas/ui/MediaPreviewModal';
import { CanvasNodeMediaControls } from '@/features/canvas/ui/CanvasNodeMediaControls';

interface CanvasNodeVideoProps {
  src: string;
  className?: string;
  selected?: boolean;
  previewTitle?: string;
}

export const CanvasNodeVideo = memo(({
  src,
  className,
  selected = false,
  previewTitle = '视频预览',
}: CanvasNodeVideoProps) => {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      return;
    }
    mediaRef.current?.pause();
  }, [selected, src]);

  const handleOpenPreview = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    mediaRef.current?.pause();
    setPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="relative min-h-0 flex-1"
          onDoubleClick={handleOpenPreview}
          title="双击打开预览"
        >
          <video
            ref={mediaRef}
            src={src}
            playsInline
            preload="metadata"
            draggable={false}
            className={`pointer-events-none h-full w-full object-contain ${className ?? ''}`}
          />
          {!selected ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/40 p-2.5">
                <Play className="h-5 w-5 fill-white/90 text-white/90" />
              </div>
            </div>
          ) : null}
        </div>
        {selected ? <CanvasNodeMediaControls mediaRef={mediaRef} /> : null}
      </div>
      <MediaPreviewModal
        isOpen={previewOpen}
        title={previewTitle}
        onClose={handleClosePreview}
        kind="video"
        mediaUrl={src}
        autoPlayVideo
      />
    </>
  );
});

CanvasNodeVideo.displayName = 'CanvasNodeVideo';
