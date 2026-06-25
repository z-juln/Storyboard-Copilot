import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { Maximize2, Music } from 'lucide-react';

import { UiModal } from '@/components/ui/primitives';

interface CanvasNodeAudioProps {
  src: string;
  className?: string;
  /** 选中时展示原生 controls；未选中时区域可拖拽节点 */
  selected?: boolean;
}

function AudioPreviewModal({
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
      title="音频预览"
      widthClassName="max-w-xl"
      bodyClassName="flex min-h-0 flex-1 flex-col p-4"
    >
      <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-lg border border-border-dark bg-bg-dark/30 px-4 py-6">
        <audio src={src} controls autoPlay className="w-full max-w-2xl" />
      </div>
    </UiModal>
  );
}

export const CanvasNodeAudio = memo(({ src, className, selected = false }: CanvasNodeAudioProps) => {
  const inlineAudioRef = useRef<HTMLAudioElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (selected) {
      return;
    }
    inlineAudioRef.current?.pause();
  }, [selected, src]);

  const handleOpenPreview = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    inlineAudioRef.current?.pause();
    setPreviewOpen(true);
  }, []);

  const handlePreviewDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    inlineAudioRef.current?.pause();
    setPreviewOpen(true);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  if (selected) {
    return (
      <>
        <div className={`nodrag relative flex h-full w-full items-center justify-center px-4 ${className ?? ''}`}>
          <audio
            ref={inlineAudioRef}
            src={src}
            controls
            className="w-full"
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="nodrag absolute bottom-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-black/45 text-white/85 transition-colors hover:bg-black/60"
            onClick={handleOpenPreview}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="全屏预览"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <AudioPreviewModal src={src} open={previewOpen} onClose={handleClosePreview} />
      </>
    );
  }

  return (
    <>
      <div
        className={`relative flex h-full w-full items-center justify-center px-4 ${className ?? ''}`}
        onDoubleClick={handlePreviewDoubleClick}
        title="点击选中后可使用控制条；双击全屏预览"
      >
        <div className="pointer-events-none flex flex-col items-center gap-2 text-text-muted/80">
          <Music className="h-8 w-8 opacity-60" />
          <span className="text-[11px]">音频</span>
        </div>
      </div>
      <AudioPreviewModal src={src} open={previewOpen} onClose={handleClosePreview} />
    </>
  );
});

CanvasNodeAudio.displayName = 'CanvasNodeAudio';
