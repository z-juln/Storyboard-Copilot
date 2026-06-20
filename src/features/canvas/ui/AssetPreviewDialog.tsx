import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { UiButton, UiModal } from '@/components/ui';
import { useSyncedTextAssetContent } from '@/features/canvas/hooks/useSyncedTextAssetContent';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import {
  countRefsForFileAssetId,
  findFileAssetIdByPath,
  createEmptyAssetManifest,
  fetchAssetTextContent,
  isBindableTextAssetFileName,
  type AssetPreviewKind,
} from '@/features/project/asset';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

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
  const [loadedContent, setLoadedContent] = useState('');
  const [loadedSyncedAt, setLoadedSyncedAt] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const nodes = useCanvasStore((store) => store.nodes);
  const assetManifest = useProjectStore((store) => store.currentProject?.assetManifest);

  const entry = state?.entry;
  const kind = state?.kind;
  const entryPath = entry?.path ?? null;
  const isOpen = Boolean(entry && kind);
  const assetUrl = entry ? buildProjectAssetUrl(projectId, entry.path) : '';
  const isEditableText = Boolean(entry && isBindableTextAssetFileName(entry.name));

  const boundNodeCount = useMemo(() => {
    if (!entry || !assetManifest) {
      return 0;
    }
    const fileAssetId = findFileAssetIdByPath(assetManifest, entry.path);
    if (!fileAssetId) {
      return 0;
    }
    return countRefsForFileAssetId(assetManifest, nodes, fileAssetId);
  }, [assetManifest, entry, nodes]);

  useEffect(() => {
    if (!isOpen || kind !== 'text' || !entryPath) {
      setLoadedContent('');
      setLoadedSyncedAt(null);
      setPreviewError(null);
      setLoadingText(false);
      setSaveHint(null);
      setSaveConfirmOpen(false);
      return;
    }

    let cancelled = false;
    setLoadingText(true);
    setPreviewError(null);
    setLoadedContent('');
    setSaveHint(null);
    setSaveConfirmOpen(false);

    void (async () => {
      try {
        const content = await fetchAssetTextContent(projectId, entryPath);
        if (cancelled) {
          return;
        }
        if (content === null) {
          setPreviewError('无法加载文本');
        } else {
          setLoadedContent(content);
          const manifest = assetManifest ?? createEmptyAssetManifest();
          const fileAssetId = findFileAssetIdByPath(manifest, entryPath);
          const syncedAt = fileAssetId ? manifest[fileAssetId]?.updatedAt ?? null : null;
          setLoadedSyncedAt(syncedAt);
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
  }, [entryPath, isOpen, kind, projectId]);

  const {
    content,
    isDirty,
    isSaving,
    updateContent,
    saveNow,
  } = useSyncedTextAssetContent({
    projectId,
    assetPath: entryPath,
    initialContent: loadedContent,
    initialSyncedAt: loadedSyncedAt,
    autoSave: false,
  });

  const executeSave = useCallback(async () => {
    const result = await saveNow();
    if (result) {
      setSaveHint(
        boundNodeCount > 0
          ? `已保存，${boundNodeCount} 个关联文本节点已同步。`
          : '已保存。'
      );
    }
    setSaveConfirmOpen(false);
  }, [boundNodeCount, saveNow]);

  const handleSave = useCallback(() => {
    if (!isEditableText || !isDirty || isSaving || loadingText) {
      return;
    }

    if (boundNodeCount > 0) {
      setSaveConfirmOpen(true);
      return;
    }

    void executeSave();
  }, [boundNodeCount, executeSave, isDirty, isEditableText, isSaving, loadingText]);

  return (
    <>
      <UiModal
        isOpen={isOpen}
        title={entry ? `预览 · ${entry.name}` : '预览'}
        onClose={onClose}
        widthClassName="w-[min(760px,calc(100vw-2rem))]"
        footer={(
          <>
            {kind === 'text' && isEditableText ? (
              <>
                {boundNodeCount > 0 ? (
                  <span className="mr-auto text-xs text-text-muted">
                    保存后画布上 {boundNodeCount} 个关联文本节点将同步更新
                  </span>
                ) : null}
                <UiButton variant="ghost" size="sm" onClick={onClose}>
                  关闭
                </UiButton>
                <UiButton
                  variant="primary"
                  size="sm"
                  disabled={!isDirty || isSaving || loadingText}
                  onClick={handleSave}
                >
                  {isSaving ? '保存中…' : '保存'}
                </UiButton>
              </>
            ) : (
              <UiButton variant="primary" size="sm" onClick={onClose}>
                关闭
              </UiButton>
            )}
          </>
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
            ) : isEditableText ? (
              <>
                <textarea
                  value={content}
                  onChange={(event) => updateContent(event.target.value)}
                  className="ui-scrollbar max-h-[min(70vh,640px)] min-h-[240px] w-full resize-y border-none bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-text-dark outline-none"
                  placeholder="（空文件）"
                />
                {saveHint ? (
                  <div className="border-t border-border-dark px-4 py-2 text-xs text-accent/90">
                    {saveHint}
                  </div>
                ) : null}
              </>
            ) : (
              <pre className="ui-scrollbar max-h-[min(70vh,640px)] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-text-dark">
                {content || '（空文件）'}
              </pre>
            )}
          </div>
        ) : null}
      </UiModal>

      <UiModal
        isOpen={saveConfirmOpen}
        title="保存文本"
        onClose={() => {
          if (!isSaving) {
            setSaveConfirmOpen(false);
          }
        }}
        widthClassName="w-[420px]"
        footer={(
          <>
            <UiButton
              variant="muted"
              size="sm"
              disabled={isSaving}
              onClick={() => setSaveConfirmOpen(false)}
            >
              取消
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              disabled={isSaving}
              onClick={() => void executeSave()}
            >
              {isSaving ? '保存中…' : '保存并同步'}
            </UiButton>
          </>
        )}
      >
        <p className="text-sm leading-relaxed text-text-dark">
          保存后，画布上{' '}
          <span className="font-medium text-accent">{boundNodeCount}</span>{' '}
          个关联文本节点将同步更新为当前内容。是否继续？
        </p>
      </UiModal>
    </>
  );
});

AssetPreviewDialog.displayName = 'AssetPreviewDialog';
