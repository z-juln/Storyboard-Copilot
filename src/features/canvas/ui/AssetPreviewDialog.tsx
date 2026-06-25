import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { openUrl } from '@tauri-apps/plugin-opener';

import { UiButton, UiModal } from '@/components/ui';
import { useSyncedTextAssetContent } from '@/features/canvas/hooks/useSyncedTextAssetContent';
import { MediaPreviewBody } from '@/features/canvas/ui/MediaPreviewBody';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import {
  countRefsForFileAssetId,
  findFileAssetIdByPath,
  createEmptyAssetManifest,
  fetchAssetTextContent,
  isBindableTextAssetFileName,
  isMarkdownTextAssetFileName,
  type AssetPreviewKind,
} from '@/features/project/asset';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';
import {
  FULLSCREEN_MODAL_BODY_CLASS,
  FULLSCREEN_MODAL_PANEL_CLASS,
} from '@/features/canvas/ui/fullscreenModalLayout';
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

type MarkdownViewMode = 'preview' | 'markdown';

const MARKDOWN_BODY_CLASS =
  'markdown-body break-words text-sm leading-relaxed text-text-dark [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_hr]:border-white/10 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+_p]:mt-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-black/30 [&_pre]:p-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5';

function MarkdownViewModeToggle({
  value,
  onChange,
}: {
  value: MarkdownViewMode;
  onChange: (next: MarkdownViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg p-0.5">
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
          value === 'preview'
            ? 'bg-bg-dark/80 font-medium text-text-dark'
            : 'text-text-muted hover:text-text-dark'
        }`}
        onClick={() => onChange('preview')}
      >
        预览
      </button>
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
          value === 'markdown'
            ? 'bg-bg-dark/80 font-medium text-text-dark'
            : 'text-text-muted hover:text-text-dark'
        }`}
        onClick={() => onChange('markdown')}
      >
        Markdown
      </button>
    </div>
  );
}

export const AssetPreviewDialog = memo(({ projectId, state, onClose }: AssetPreviewDialogProps) => {
  const [loadedContent, setLoadedContent] = useState('');
  const [loadedSyncedAt, setLoadedSyncedAt] = useState<number | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [markdownViewMode, setMarkdownViewMode] = useState<MarkdownViewMode>('preview');

  const nodes = useCanvasStore((store) => store.nodes);
  const assetManifest = useProjectStore((store) => store.currentProject?.assetManifest);

  const entry = state?.entry;
  const kind = state?.kind;
  const entryPath = entry?.path ?? null;
  const isOpen = Boolean(entry && kind && kind !== 'image');
  const assetUrl = entry ? buildProjectAssetUrl(projectId, entry.path) : '';
  const isEditableText = Boolean(entry && isBindableTextAssetFileName(entry.name));
  const isMarkdown = Boolean(entry && isMarkdownTextAssetFileName(entry.name));

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
    if (isOpen) {
      setMarkdownViewMode('preview');
    }
  }, [entryPath, isOpen]);

  const handleMarkdownLinkClick = useCallback((href?: string) => {
    if (!href) {
      return;
    }
    void openUrl(href);
  }, []);

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
        widthClassName={FULLSCREEN_MODAL_PANEL_CLASS}
        bodyClassName={FULLSCREEN_MODAL_BODY_CLASS}
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
        {kind === 'video' || kind === 'audio' ? (
          <MediaPreviewBody kind={kind} mediaUrl={assetUrl} />
        ) : null}

        {kind === 'text' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-dark bg-bg-dark/30">
            {isMarkdown && !loadingText && !previewError ? (
              <div className="flex justify-end border-b border-border-dark px-3 py-2">
                <MarkdownViewModeToggle
                  value={markdownViewMode}
                  onChange={setMarkdownViewMode}
                />
              </div>
            ) : null}
            {loadingText ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">加载中…</div>
            ) : previewError ? (
              <div className="px-4 py-8 text-center text-sm text-red-400">{previewError}</div>
            ) : isMarkdown && markdownViewMode === 'preview' ? (
              <div className={`ui-scrollbar min-h-0 flex-1 overflow-auto px-4 py-3 ${MARKDOWN_BODY_CLASS}`}>
                {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a
                          {...props}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => {
                            event.preventDefault();
                            handleMarkdownLinkClick(href);
                          }}
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <span className="text-text-muted">（空文件）</span>
                )}
              </div>
            ) : isEditableText ? (
              <>
                <textarea
                  value={content}
                  onChange={(event) => updateContent(event.target.value)}
                  className="ui-scrollbar min-h-0 flex-1 w-full resize-none border-none bg-transparent px-4 py-3 font-mono text-xs leading-relaxed text-text-dark outline-none"
                  placeholder="（空文件）"
                />
                {saveHint ? (
                  <div className="border-t border-border-dark px-4 py-2 text-xs text-accent/90">
                    {saveHint}
                  </div>
                ) : null}
              </>
            ) : (
              <pre className="ui-scrollbar min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-text-dark">
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
