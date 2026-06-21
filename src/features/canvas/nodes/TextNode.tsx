import {
  memo,
  useCallback,
  useMemo,
} from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { openUrl } from '@tauri-apps/plugin-opener';

import {
  TEXT_NODE_DEFAULT_HEIGHT,
  TEXT_NODE_DEFAULT_WIDTH,
  TEXT_NODE_MAX_HEIGHT,
  TEXT_NODE_MAX_WIDTH,
  TEXT_NODE_MIN_HEIGHT,
  TEXT_NODE_MIN_WIDTH,
} from '@/features/canvas/application/textNodeSizing';
import { replaceBoundNodeAssetIfNeeded } from '@/features/canvas/application/nodeAssetFileActions';
import { CANVAS_NODE_TYPES, type TextNodeData } from '@/features/canvas/domain/canvasNodes';
import { resolveNodeDisplayName } from '@/features/canvas/domain/nodeDisplay';
import { useNodeAssetReplaceFileInput } from '@/features/canvas/hooks/useNodeAssetReplaceFileInput';
import { useSyncedTextAssetContent } from '@/features/canvas/hooks/useSyncedTextAssetContent';
import { NodeEditableTextarea } from '@/features/canvas/ui/NodeEditableTextarea';
import { NodeAssetBindingMeta } from '@/features/canvas/ui/NodeAssetBindingMeta';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeAssetUnavailableNotice } from '@/features/canvas/ui/NodeAssetUnavailableNotice';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import {
  PROJECT_ASSET_UNAVAILABLE_MESSAGE,
  useIsProjectAssetUnavailable,
} from '@/features/project/asset';
import { isMarkdownTextAssetFileName } from '@/features/project/asset/assetPreviewUtils';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';

type TextNodeProps = NodeProps & {
  id: string;
  data: TextNodeData;
  selected?: boolean;
};

export const TextNode = memo(({
  id,
  data,
  selected,
  width,
  height,
}: TextNodeProps) => {
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const projectId = useProjectStore((state) => state.currentProjectId);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);

  const sourceFileName = typeof data.sourceFileName === 'string' ? data.sourceFileName : '';
  const assetPath = typeof data.imageUrl === 'string' ? data.imageUrl : null;
  const initialContent = typeof data.textContent === 'string' ? data.textContent : '';
  const initialSyncedAt = typeof data.textSyncedAt === 'number' ? data.textSyncedAt : null;
  const isMarkdown = isMarkdownTextAssetFileName(sourceFileName);

  const assetBinding = useMemo(
    () => ({ imageUrl: data.imageUrl, fileAssetId: data.fileAssetId }),
    [data.fileAssetId, data.imageUrl]
  );
  const isAssetUnavailable = useIsProjectAssetUnavailable(assetBinding);

  const handleContentSaved = useCallback((content: string, updatedAt: number) => {
    updateNodeData(id, { textContent: content, textSyncedAt: updatedAt });
  }, [id, updateNodeData]);

  const {
    content,
    updateContent,
  } = useSyncedTextAssetContent({
    projectId,
    assetPath,
    initialContent,
    initialSyncedAt,
    autoSave: true,
    onContentSaved: handleContentSaved,
  });

  const handleMarkdownLinkClick = useCallback((href?: string) => {
    if (!href) {
      return;
    }
    void openUrl(href);
  }, []);

  const resolvedTitle = resolveNodeDisplayName(CANVAS_NODE_TYPES.text, data);
  const resolvedWidth = Math.max(TEXT_NODE_MIN_WIDTH, Math.round(width ?? TEXT_NODE_DEFAULT_WIDTH));
  const resolvedHeight = Math.max(TEXT_NODE_MIN_HEIGHT, Math.round(height ?? TEXT_NODE_DEFAULT_HEIGHT));
  const handleContentChange = useCallback((nextContent: string) => {
    updateContent(nextContent);
    updateNodeData(id, { textContent: nextContent });
  }, [id, updateContent, updateNodeData]);

  const handleReplaceFile = useCallback(async (file: File) => {
    const replaced = await replaceBoundNodeAssetIfNeeded({
      projectId,
      assetManifest,
      commitAssetManifest,
      imageUrl: data.imageUrl,
      fileAssetId: data.fileAssetId,
      file,
    });
    if (!replaced) {
      throw new Error('文本节点未绑定项目文件，无法替换');
    }
  }, [assetManifest, commitAssetManifest, data.fileAssetId, data.imageUrl, projectId]);

  const {
    inputRef,
    fileInputAccept,
    handleFileChange,
  } = useNodeAssetReplaceFileInput({
    nodeId: id,
    assetKind: 'text',
    imageUrl: data.imageUrl,
    fileAssetId: data.fileAssetId,
    onFileSelected: handleReplaceFile,
  });

  const renderTextPreview = useCallback((previewContent: string) => (
    isMarkdown ? (
      <div className="markdown-body break-words [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_hr]:border-white/10 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_p+_p]:mt-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-black/30 [&_pre]:p-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:border-white/10 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/10 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5">
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
          {previewContent}
        </ReactMarkdown>
      </div>
    ) : (
      <pre className="whitespace-pre-wrap break-words font-sans">{previewContent}</pre>
    )
  ), [handleMarkdownLinkClick, isMarkdown]);

  return (
    <div
      className={`
        group relative h-full w-full overflow-visible rounded-[var(--node-radius)] border bg-surface-dark/85 p-1.5 transition-colors duration-150
        ${selected
          ? 'border-accent shadow-[0_0_0_1px_rgba(59,130,246,0.32)]'
          : 'border-[rgba(15,23,42,0.22)] hover:border-[rgba(15,23,42,0.34)] dark:border-[rgba(255,255,255,0.22)] dark:hover:border-[rgba(255,255,255,0.34)]'}
      `}
      style={{ width: resolvedWidth, height: resolvedHeight }}
      onClick={() => setSelectedNode(id)}
    >
      <NodeHeader
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
        icon={<FileText className="h-4 w-4" />}
        titleText={resolvedTitle}
        meta={(
          <NodeAssetBindingMeta
            binding={assetBinding}
            sourceFileName={sourceFileName}
          />
        )}
        editable
        onTitleChange={(nextTitle) => updateNodeData(id, { displayName: nextTitle })}
      />

      <NodeResizeHandle
        minWidth={TEXT_NODE_MIN_WIDTH}
        minHeight={TEXT_NODE_MIN_HEIGHT}
        maxWidth={TEXT_NODE_MAX_WIDTH}
        maxHeight={TEXT_NODE_MAX_HEIGHT}
      />

      <div className="flex h-full w-full flex-col overflow-hidden rounded-md">
        {isAssetUnavailable ? (
          <NodeAssetUnavailableNotice message={PROJECT_ASSET_UNAVAILABLE_MESSAGE} />
        ) : (
          <NodeEditableTextarea
            selected={selected}
            value={content}
            onValueChange={handleContentChange}
            placeholder={isMarkdown ? '输入 Markdown 文本…' : '输入文本…'}
            emptyPreview={<div className="pt-1 text-text-muted">双击编辑文本</div>}
            renderPreview={renderTextPreview}
            onEnterEditing={() => setSelectedNode(id)}
            className="h-full w-full resize-none border-none bg-transparent px-1 py-0.5 text-sm leading-6 text-text-dark outline-none placeholder:text-text-muted/70"
            previewClassName="px-1 py-0.5 text-sm leading-6 text-text-dark"
          />
        )}
      </div>

      <Handle
        type="source"
        id="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-surface-dark !bg-accent"
      />
      <input
        ref={inputRef}
        type="file"
        accept={fileInputAccept}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
});

TextNode.displayName = 'TextNode';
