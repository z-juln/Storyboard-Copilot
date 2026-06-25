import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from '@xyflow/react';
import { Music } from 'lucide-react';

import {
  CANVAS_NODE_TYPES,
  EXPORT_RESULT_NODE_MIN_HEIGHT,
  EXPORT_RESULT_NODE_MIN_WIDTH,
  type UploadAudioNodeData,
} from '@/features/canvas/domain/canvasNodes';
import {
  resolveMinEdgeFittedSize,
  resolveResizeMinConstraintsByAspect,
} from '@/features/canvas/application/imageNodeSizing';
import {
  isNodeUsingDefaultDisplayName,
  resolveNodeDisplayName,
} from '@/features/canvas/domain/nodeDisplay';
import { replaceBoundNodeAssetIfNeeded } from '@/features/canvas/application/nodeAssetFileActions';
import { useNodeAssetReplaceFileInput } from '@/features/canvas/hooks/useNodeAssetReplaceFileInput';
import { subscribeUploadNodePasteImage } from '@/features/canvas/application/uploadNodePasteBridge';
import {
  importNodeAudioFromFile,
  isAudioUploadFile,
} from '@/features/canvas/application/importNodeAudioFromFile';
import { NodeAssetBindingMeta } from '@/features/canvas/ui/NodeAssetBindingMeta';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import { UploadNodeMediaBody } from '@/features/canvas/nodes/UploadNodeMediaBody';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createEmptyAssetManifest, resolveFileAssetDisplayUrl } from '@/features/project/asset';

type UploadAudioNodeProps = NodeProps & {
  id: string;
  data: UploadAudioNodeData;
  selected?: boolean;
};

function resolveNodeDimension(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    return Math.round(value);
  }
  return fallback;
}

export const UploadAudioNode = memo(({ id, data, selected, width, height }: UploadAudioNodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const projectId = useProjectStore((state) => state.currentProjectId);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);
  const useUploadFilenameAsNodeTitle = useSettingsStore((state) => state.useUploadFilenameAsNodeTitle);
  const uploadSequenceRef = useRef(0);
  const [transientPreviewUrl, setTransientPreviewUrl] = useState<string | null>(null);
  const resolvedAspectRatio = data.aspectRatio || '16:3';
  const compactSize = resolveMinEdgeFittedSize(resolvedAspectRatio, {
    minWidth: EXPORT_RESULT_NODE_MIN_WIDTH,
    minHeight: EXPORT_RESULT_NODE_MIN_HEIGHT,
  });
  const resolvedWidth = resolveNodeDimension(width, compactSize.width);
  const resolvedHeight = resolveNodeDimension(height, compactSize.height);
  const resizeConstraints = resolveResizeMinConstraintsByAspect(resolvedAspectRatio, {
    minWidth: EXPORT_RESULT_NODE_MIN_WIDTH,
    minHeight: EXPORT_RESULT_NODE_MIN_HEIGHT,
  });
  const resolvedTitle = useMemo(() => {
    const sourceFileName = typeof data.sourceFileName === 'string' ? data.sourceFileName.trim() : '';
    if (
      useUploadFilenameAsNodeTitle
      && sourceFileName
      && isNodeUsingDefaultDisplayName(CANVAS_NODE_TYPES.uploadAudio, data)
    ) {
      return sourceFileName;
    }

    return resolveNodeDisplayName(CANVAS_NODE_TYPES.uploadAudio, data);
  }, [data, useUploadFilenameAsNodeTitle]);

  const clearTransientPreview = useCallback(() => {
    setTransientPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (!projectId) {
        throw new Error('未打开项目，无法上传音频');
      }

      const sequence = uploadSequenceRef.current + 1;
      uploadSequenceRef.current = sequence;
      clearTransientPreview();
      const optimisticPreviewUrl = URL.createObjectURL(file);
      setTransientPreviewUrl(optimisticPreviewUrl);

      try {
        const replaced = await replaceBoundNodeAssetIfNeeded({
          projectId,
          assetManifest,
          commitAssetManifest,
          imageUrl: data.imageUrl,
          fileAssetId: data.fileAssetId,
          file,
        });

        if (replaced) {
          if (uploadSequenceRef.current === sequence) {
            clearTransientPreview();
          }
          return;
        }

        if (!isAudioUploadFile(file)) {
          throw new Error('只能上传音频文件');
        }

        const manifest = assetManifest ?? createEmptyAssetManifest();
        const imported = await importNodeAudioFromFile({
          projectId,
          file,
          manifest,
        });
        commitAssetManifest(imported.manifest);

        const nextData: Partial<UploadAudioNodeData> = {
          imageUrl: imported.path,
          fileAssetId: imported.fileAssetId,
          sourceFileName: file.name,
          mediaKind: 'audio',
          aspectRatio: '16:3',
        };
        if (useUploadFilenameAsNodeTitle) {
          nextData.displayName = file.name;
        }
        updateNodeData(id, nextData);

        if (uploadSequenceRef.current === sequence) {
          clearTransientPreview();
        }
      } catch (error) {
        if (uploadSequenceRef.current === sequence) {
          clearTransientPreview();
        }
        console.error('[upload-audio] processFile failed', error);
        throw error;
      }
    },
    [
      assetManifest,
      clearTransientPreview,
      commitAssetManifest,
      data.fileAssetId,
      data.imageUrl,
      id,
      projectId,
      updateNodeData,
      useUploadFilenameAsNodeTitle,
    ]
  );

  const {
    inputRef,
    fileInputAccept,
    openFilePicker,
    handleFileChange,
  } = useNodeAssetReplaceFileInput({
    nodeId: id,
    assetKind: 'audio',
    imageUrl: data.imageUrl,
    fileAssetId: data.fileAssetId,
    onFileSelected: processFile,
  });

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files?.[0];
      if (!file || !isAudioUploadFile(file)) {
        return;
      }

      await processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    return subscribeUploadNodePasteImage(id, (file) => {
      if (!isAudioUploadFile(file)) {
        return;
      }
      void processFile(file);
    });
  }, [id, processFile]);

  const handleNodeClick = useCallback(() => {
    setSelectedNode(id);
    const hasBoundAsset = Boolean(data.imageUrl || transientPreviewUrl);
    if (!hasBoundAsset) {
      openFilePicker();
    }
  }, [data.imageUrl, id, openFilePicker, setSelectedNode, transientPreviewUrl]);

  useEffect(() => () => {
    clearTransientPreview();
  }, [clearTransientPreview]);

  const assetMediaUrl = useMemo(() => {
    if (transientPreviewUrl) {
      return transientPreviewUrl;
    }
    return resolveFileAssetDisplayUrl({
      projectId,
      fileAssetId: data.fileAssetId,
      imageUrl: data.imageUrl,
      assetManifest,
    });
  }, [assetManifest, data.fileAssetId, data.imageUrl, projectId, transientPreviewUrl]);

  const assetBinding = useMemo(
    () => ({
      imageUrl: data.imageUrl,
      fileAssetId: data.fileAssetId,
    }),
    [data.fileAssetId, data.imageUrl]
  );

  const hasMediaContent = Boolean(transientPreviewUrl || data.imageUrl);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, resolvedHeight, resolvedWidth, updateNodeInternals]);

  const shellClassName = selected
    ? 'border-2 border-accent p-1.5 shadow-[0_0_0_2px_rgba(59,130,246,0.62),0_0_0_4px_rgba(8,12,22,0.96),0_0_24px_rgba(59,130,246,0.34)]'
    : 'border border-[rgba(15,23,42,0.22)] p-0 hover:border-[rgba(15,23,42,0.34)] dark:border-[rgba(255,255,255,0.22)] dark:hover:border-[rgba(255,255,255,0.34)]';

  return (
    <div
      className={`
        group relative overflow-visible rounded-[var(--node-radius)] bg-surface-dark/85 transition-[border-color,box-shadow,padding] duration-150
        ${shellClassName}
      `}
      style={{ width: resolvedWidth, height: resolvedHeight }}
      onClick={handleNodeClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <NodeHeader
        className={NODE_HEADER_FLOATING_POSITION_CLASS}
        icon={<Music className="h-4 w-4" />}
        titleText={resolvedTitle}
        meta={hasMediaContent ? (
          <NodeAssetBindingMeta
            binding={assetBinding}
            sourceFileName={typeof data.sourceFileName === 'string' ? data.sourceFileName : ''}
          />
        ) : null}
        editable
        onTitleChange={(nextTitle) => updateNodeData(id, { displayName: nextTitle })}
      />

      {hasMediaContent ? (
        <UploadNodeMediaBody
          mediaKind="audio"
          assetBinding={assetBinding}
          assetMediaUrl={assetMediaUrl}
          imageSource={null}
          imageViewerSourceUrl={null}
          textContent={null}
          onImageLoad={() => {}}
          nodeSelected={selected}
        />
      ) : (
        <label className="block h-full w-full overflow-hidden rounded-[var(--node-radius)] bg-bg-dark">
          <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-text-muted/85">
            <Music className="h-7 w-7 opacity-60" />
            <span className="px-3 text-center text-[12px] leading-6">点击或拖拽上传音频</span>
          </div>
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={fileInputAccept}
        className="hidden"
        onChange={handleFileChange}
      />

      <Handle
        type="source"
        id="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-surface-dark !bg-accent"
      />
      <NodeResizeHandle
        minWidth={resizeConstraints.minWidth}
        minHeight={resizeConstraints.minHeight}
        maxWidth={1400}
        maxHeight={1400}
      />
    </div>
  );
});

UploadAudioNode.displayName = 'UploadAudioNode';
