import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { Pause, Play } from 'lucide-react';

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

interface CanvasNodeMediaControlsProps {
  mediaRef: RefObject<HTMLMediaElement | null>;
}

export const CanvasNodeMediaControls = memo(({ mediaRef }: CanvasNodeMediaControlsProps) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const syncFromMedia = useCallback(() => {
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    setPlaying(!media.paused);
    setCurrentTime(media.currentTime);
    setDuration(Number.isFinite(media.duration) ? media.duration : 0);
  }, [mediaRef]);

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) {
      return undefined;
    }

    syncFromMedia();
    media.addEventListener('timeupdate', syncFromMedia);
    media.addEventListener('play', syncFromMedia);
    media.addEventListener('pause', syncFromMedia);
    media.addEventListener('loadedmetadata', syncFromMedia);
    media.addEventListener('durationchange', syncFromMedia);

    return () => {
      media.removeEventListener('timeupdate', syncFromMedia);
      media.removeEventListener('play', syncFromMedia);
      media.removeEventListener('pause', syncFromMedia);
      media.removeEventListener('loadedmetadata', syncFromMedia);
      media.removeEventListener('durationchange', syncFromMedia);
    };
  }, [mediaRef, syncFromMedia]);

  const handleTogglePlay = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    if (media.paused) {
      void media.play();
    } else {
      media.pause();
    }
  }, [mediaRef]);

  const handleSeek = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const media = mediaRef.current;
    if (!media) {
      return;
    }
    media.currentTime = Number(event.target.value);
    syncFromMedia();
  }, [mediaRef, syncFromMedia]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <div
      className="nodrag flex shrink-0 items-center gap-2 border-t border-border-dark/60 bg-bg-dark/90 px-2 py-1.5"
      onPointerDown={handlePointerDown}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-dark hover:bg-bg-dark"
        onClick={handleTogglePlay}
        aria-label={playing ? '暂停' : '播放'}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 0}
        step={0.1}
        value={Math.min(currentTime, duration > 0 ? duration : 0)}
        onChange={handleSeek}
        className="min-w-0 flex-1 accent-accent"
      />
      <span className="shrink-0 tabular-nums text-[10px] text-text-muted">
        {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
      </span>
    </div>
  );
});

CanvasNodeMediaControls.displayName = 'CanvasNodeMediaControls';
