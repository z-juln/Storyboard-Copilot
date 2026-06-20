import { memo, useEffect, useState } from 'react';

import { UiButton, UiModal } from '@/components/ui';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import {
  MAX_TEXT_PREVIEW_CHARS,
  type AssetPreviewKind,
} from '@/features/project/asset/assetPreviewUtils';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';

export interface AssetPreviewState {
  entry: ProjectDirectoryEntry;
  kind: AssetPreviewKind;
}

interface AssetPreviewDialogProps {
  projectId: string;
  state: AssetPreviewState | null;
  onClose: () => void;
}

export const AssetPreviewDialog = memo(({ projectId, state, onClose }: AssetPreviewDialogProps) => {
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const entry = state?.entry;
  const kind = state?.kind;
  const isOpen = Boolean(entry && kind);
  const assetUrl = entry ? buildProjectAssetUrl(projectId, entry.path) : '';

  useEffect(() => {
    if (!isOpen || kind !== 'text' || !assetUrl) {
      setTextContent('');
      setPreviewError(null);
      setLoadingText(false);
      return;
    }

    let cancelled = false;
    setLoadingText(true);
    setPreviewError(null);
    setTextContent('');

    void (async () => {
      try {
        const response = await fetch(assetUrl);
        if (!response.ok) {
          throw new Error(`读取失败 (${response.status})`);
        }
        const raw = await response.text();
        if (cancelled) {
          return;
        }
        if (raw.length > MAX_TEXT_PREVIEW_CHARS) {
          setTextContent(`${raw.slice(0, MAX_TEXT_PREVIEW_CHARS)}\n\n…（内容过长，已截断）`);
        } else {
          setTextContent(raw);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(error instanceof Error ? error.message : '无法加载文本');
        }
      } finally {
        if (!cancelled) {
          setLoadingText(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetUrl, isOpen, kind]);

  return (
    <UiModal
      isOpen={isOpen}
      title={entry ? `预览 · ${entry.name}` : '预览'}
      onClose={onClose}
      widthClassName="w-[min(760px,calc(100vw-2rem))]"
      footer={(
        <UiButton variant="primary" size="sm" onClick={onClose}>
          关闭
        </UiButton>
      )}
    >
      {kind === 'image' ? (
        <div className="flex max-h-[min(70vh,640px)] items-center justify-center overflow-hidden rounded-lg bg-bg-dark/40">
          <img
            src={assetUrl}
            alt={entry?.name ?? 'preview'}
            className="max-h-[min(70vh,640px)] max-w-full object-contain"
          />
        </div>
      ) : null}

      {kind === 'video' ? (
        <video
          src={assetUrl}
          controls
          playsInline
          className="max-h-[min(70vh,640px)] w-full rounded-lg bg-black"
        />
      ) : null}

      {kind === 'audio' ? (
        <div className="rounded-lg border border-border-dark bg-bg-dark/30 px-4 py-6">
          <audio src={assetUrl} controls className="w-full" />
        </div>
      ) : null}

      {kind === 'text' ? (
        <div className="rounded-lg border border-border-dark bg-bg-dark/30">
          {loadingText ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">加载中…</div>
          ) : previewError ? (
            <div className="px-4 py-8 text-center text-sm text-red-400">{previewError}</div>
          ) : (
            <pre className="ui-scrollbar max-h-[min(70vh,640px)] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-text-dark">
              {textContent || '（空文件）'}
            </pre>
          )}
        </div>
      ) : null}
    </UiModal>
  );
});

AssetPreviewDialog.displayName = 'AssetPreviewDialog';
