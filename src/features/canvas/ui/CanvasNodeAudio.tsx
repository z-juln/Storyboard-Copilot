import { memo, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Music } from 'lucide-react';

import { MediaPreviewModal } from '@/features/canvas/ui/MediaPreviewModal';
import { CanvasNodeMediaControls } from '@/features/canvas/ui/CanvasNodeMediaControls';

interface CanvasNodeAudioProps {
  src: string;
  className?: string;
  selected?: boolean;
  previewTitle?: string;
}

export const CanvasNodeAudio = memo(({
  src,
  className,
  selected = false,
  previewTitle = '音频预览',
}: CanvasNodeAudioProps) => {
  const mediaRef = useRef<HTMLAudioElement>(null);
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
      <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
        <audio ref={mediaRef} src={src} preload="metadata" className="hidden" />
        <div
          className="flex min-h-0 flex-1 items-center justify-center"
          onDoubleClick={handleOpenPreview}
          title="双击打开预览"
        >
          <div className="pointer-events-none flex flex-col items-center gap-2 text-text-muted/80">
            <Music className="h-8 w-8 opacity-60" />
            <span className="text-[11px]">音频</span>
          </div>
        </div>
        {selected ? <CanvasNodeMediaControls mediaRef={mediaRef} /> : null}
      </div>
      <MediaPreviewModal
        isOpen={previewOpen}
        title={previewTitle}
        onClose={handleClosePreview}
        kind="audio"
        mediaUrl={src}
      />
    </>
  );
});

CanvasNodeAudio.displayName = 'CanvasNodeAudio';
