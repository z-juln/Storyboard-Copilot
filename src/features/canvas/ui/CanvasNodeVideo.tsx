import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Maximize2, Play } from 'lucide-react';

import { UiModal } from '@/components/ui/primitives';

interface CanvasNodeVideoProps {
  src: string;
  className?: string;
  /** 选中时展示原生 controls；未选中时画面区可拖拽节点 */
  selected?: boolean;
}

function VideoPreviewModal({
  src,
  open,
  onClose,
}: {
  src: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <UiModal
      isOpen={open}
      onClose={onClose}
      title="视频预览"
      widthClassName="max-w-4xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-4"
    >
      <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-lg bg-black/20">
        <video
          src={src}
          controls
          autoPlay
          playsInline
          className="max-h-[70vh] max-w-full object-contain"
        />
      </div>
    </UiModal>
  );
}

export const CanvasNodeVideo = memo(({ src, className, selected = false }: CanvasNodeVideoProps) => {
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      return;
    }
    inlineVideoRef.current?.pause();
  }, [selected, src]);

  const handleOpenPreview = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    inlineVideoRef.current?.pause();
    setPreviewOpen(true);
  }, []);

  const handlePreviewDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    inlineVideoRef.current?.pause();
    setPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  if (selected) {
    return (
      <>
        <div className="nodrag relative h-full w-full">
          <video
            ref={inlineVideoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            draggable={false}
            className={`h-full w-full object-contain ${className ?? ''}`}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="nodrag absolute bottom-10 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-black/45 text-white/85 transition-colors hover:bg-black/60"
            onClick={handleOpenPreview}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="全屏预览"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <VideoPreviewModal src={src} open={previewOpen} onClose={handleClosePreview} />
      </>
    );
  }

  return (
    <>
      <div
        className="relative h-full w-full"
        onDoubleClick={handlePreviewDoubleClick}
        title="点击选中后可使用控制条；双击全屏预览"
      >
        <video
          ref={inlineVideoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          draggable={false}
          className={`pointer-events-none h-full w-full object-contain ${className ?? ''}`}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-black/40 p-2.5">
            <Play className="h-5 w-5 fill-white/90 text-white/90" />
          </div>
        </div>
      </div>
      <VideoPreviewModal src={src} open={previewOpen} onClose={handleClosePreview} />
    </>
  );
});

CanvasNodeVideo.displayName = 'CanvasNodeVideo';
