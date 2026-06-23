import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';

import { UiModal } from '@/components/ui/primitives';
import {
  readGitChangeCurrentText,
  readGitCommittedBlob,
} from '@/features/git/application/projectGitService';
import type { ProjectGitBlob } from '@/features/git/types';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';
import {
  FULLSCREEN_MODAL_BODY_CLASS,
  FULLSCREEN_MODAL_PANEL_CLASS,
} from '@/features/canvas/ui/fullscreenModalLayout';

import { GitTextDiffViewer } from './GitTextDiffViewer';
import {
  resolveGitBlobMime,
  resolveGitChangePreviewKind,
  type GitChangePreviewKind,
} from './gitDiffUtils';

interface SimpleAssetDiffDialogProps {
  projectId: string;
  path: string;
  commit: string | null;
  changeKind: string;
  open: boolean;
  onClose: () => void;
}

function blobToDataUrl(blob: ProjectGitBlob, mime: string): string | null {
  if (blob.kind === 'binary' && blob.base64) {
    return `data:${mime};base64,${blob.base64}`;
  }
  return null;
}

function DiffColumn({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="mb-2 shrink-0 text-xs text-text-muted">{label}</div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function MediaPane({
  kind,
  src,
  emptyMessage,
}: {
  kind: Extract<GitChangePreviewKind, 'image' | 'video' | 'audio'>;
  src: string | null;
  emptyMessage: string;
}) {
  if (!src) {
    return <div className="text-xs text-text-muted">{emptyMessage}</div>;
  }

  if (kind === 'image') {
    return (
      <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-lg bg-black/20">
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <video
        src={src}
        controls
        playsInline
        className="max-h-full max-w-full rounded-lg bg-black object-contain"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 items-center rounded-lg border border-border-dark bg-bg-dark/30 px-3 py-4">
      <audio src={src} controls className="w-full" />
    </div>
  );
}

export const SimpleAssetDiffDialog = memo(({
  projectId,
  path,
  commit,
  changeKind,
  open,
  onClose,
}: SimpleAssetDiffDialogProps) => {
  const [beforeBlob, setBeforeBlob] = useState<ProjectGitBlob | null>(null);
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [loading, setLoading] = useState(false);

  const previewKind = useMemo(() => resolveGitChangePreviewKind(path), [path]);
  const isDeleted = changeKind === 'deleted';
  const isAdded = changeKind === 'added';
  const beforeLabel = commit ? `过去（${commit.slice(0, 7)}）` : '过去';
  const afterLabel = '现在';

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setBeforeBlob(null);
    setBeforeText('');
    setAfterText('');

    void (async () => {
      try {
        if (commit && !isAdded) {
          const committed = await readGitCommittedBlob(projectId, commit, path);
          if (cancelled) {
            return;
          }
          setBeforeBlob(committed);
          if (previewKind === 'text') {
            setBeforeText(
              committed.kind === 'missing' ? '' : committed.text ?? '',
            );
          }
        }

        if (!isDeleted && previewKind === 'text') {
          const currentText = await readGitChangeCurrentText(projectId, path);
          if (!cancelled) {
            setAfterText(currentText);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commit, isAdded, isDeleted, open, path, previewKind, projectId]);

  const mime = useMemo(() => {
    if (!previewKind || previewKind === 'text') {
      return 'text/plain';
    }
    return resolveGitBlobMime(path, previewKind);
  }, [path, previewKind]);

  const beforeMediaUrl = useMemo(() => {
    if (!previewKind || previewKind === 'text' || !beforeBlob) {
      return null;
    }
    if (beforeBlob.kind === 'missing') {
      return null;
    }
    return blobToDataUrl(beforeBlob, mime);
  }, [beforeBlob, mime, previewKind]);

  const afterMediaUrl = useMemo(() => {
    if (!previewKind || previewKind === 'text' || isDeleted || !path.startsWith('assets/')) {
      return null;
    }
    return buildProjectAssetUrl(projectId, path);
  }, [isDeleted, path, previewKind, projectId]);

  const beforeEmptyMessage = isAdded ? '（新文件）' : '（该版本无此文件）';
  const afterEmptyMessage = '（文件已删除）';

  return (
    <UiModal
      isOpen={open}
      onClose={onClose}
      title={`对比 · ${path}`}
      widthClassName={FULLSCREEN_MODAL_PANEL_CLASS}
      bodyClassName={FULLSCREEN_MODAL_BODY_CLASS}
    >
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">加载中…</div>
      ) : !previewKind ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">该文件类型暂不支持对比预览</div>
      ) : previewKind === 'text' ? (
        <GitTextDiffViewer
          path={path}
          oldValue={beforeText}
          newValue={afterText}
          leftTitle={beforeLabel}
          rightTitle={afterLabel}
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <DiffColumn label={beforeLabel}>
            <MediaPane
              kind={previewKind}
              src={beforeMediaUrl}
              emptyMessage={beforeEmptyMessage}
            />
          </DiffColumn>
          <DiffColumn label={afterLabel}>
            <MediaPane
              kind={previewKind}
              src={afterMediaUrl}
              emptyMessage={afterEmptyMessage}
            />
          </DiffColumn>
        </div>
      )}
    </UiModal>
  );
});

SimpleAssetDiffDialog.displayName = 'SimpleAssetDiffDialog';
