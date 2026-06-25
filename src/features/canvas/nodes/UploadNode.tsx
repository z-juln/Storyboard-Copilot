import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type SyntheticEvent,
} from 'react';
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  useViewport,
  type NodeProps,
} from '@xyflow/react';
import { Upload } from 'lucide-react';

import {
  CANVAS_NODE_TYPES,
  EXPORT_RESULT_NODE_MIN_HEIGHT,
  EXPORT_RESULT_NODE_MIN_WIDTH,
  type UploadImageNodeData,
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
import { resolveDroppedImageFile } from '@/features/canvas/application/resolveDroppedExternalFile';
import { NodeAssetBindingMeta } from '@/features/canvas/ui/NodeAssetBindingMeta';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import {
  prepareNodeImageFromFile,
  resolveNodeImageDisplayUrl,
  shouldUseOriginalImageByZoom,
  toPreparedNodeImageFields,
} from '@/features/canvas/application/imageData';
import { resolveMediaPreviewTitle } from '@/features/canvas/ui/mediaPreviewShared';
import { UploadNodeMediaBody } from '@/features/canvas/nodes/UploadNodeMediaBody';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { resolveFileAssetDisplayUrl } from '@/features/project/asset';
import { fetchAssetTextContent } from '@/features/project/asset/assetPreviewUtils';

type UploadNodeProps = NodeProps & {
  id: string;
  data: UploadImageNodeData;
  selected?: boolean;
};

function resolveNodeDimension(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    return Math.round(value);
  }
  return fallback;
}

export const UploadNode = memo(({ id, data, selected, width, height }: UploadNodeProps) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const projectId = useProjectStore((state) => state.currentProjectId);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);
  const useUploadFilenameAsNodeTitle = useSettingsStore((state) => state.useUploadFilenameAsNodeTitle);
  const { zoom } = useViewport();
  const uploadSequenceRef = useRef(0);
  const uploadPerfRef = useRef<{
    sequence: number;
    name: string;
    size: number;
    startedAt: number;
    transientLoaded: boolean;
    stableLoaded: boolean;
  } | null>(null);
  const [transientPreviewUrl, setTransientPreviewUrl] = useState<string | null>(null);
  const resolvedAspectRatio = data.aspectRatio || '1:1';
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
  const resizeMinWidth = resizeConstraints.minWidth;
  const resizeMinHeight = resizeConstraints.minHeight;
  const resolvedTitle = useMemo(() => {
    const sourceFileName = typeof data.sourceFileName === 'string' ? data.sourceFileName.trim() : '';
    if (
      useUploadFilenameAsNodeTitle
      && sourceFileName
      && isNodeUsingDefaultDisplayName(CANVAS_NODE_TYPES.upload, data)
    ) {
      return sourceFileName;
    }

    return resolveNodeDisplayName(CANVAS_NODE_TYPES.upload, data);
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
      const sequence = uploadSequenceRef.current + 1;
      uploadSequenceRef.current = sequence;
      const started = performance.now();
      clearTransientPreview();
      const optimisticPreviewUrl = URL.createObjectURL(file);
      setTransientPreviewUrl(optimisticPreviewUrl);
      uploadPerfRef.current = {
        sequence,
        name: file.name,
        size: file.size,
        startedAt: started,
        transientLoaded: false,
        stableLoaded: false,
      };
      requestAnimationFrame(() => {
        const perf = uploadPerfRef.current;
        if (!perf || perf.sequence !== sequence) {
          return;
        }
        console.info(
          `[upload-perf][e2e] preview-state-committed nodeId=${id} name="${file.name}" elapsed=${Math.round(performance.now() - started)}ms`
        );
      });

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

          console.info(
            `[upload-perf][node] replaceFile success nodeId=${id} name="${file.name}" size=${file.size}B elapsed=${Math.round(performance.now() - started)}ms`
          );
          return;
        }

        if (!file.type.startsWith('image/')) {
          throw new Error('只能上传图片文件');
        }

        const prepared = await prepareNodeImageFromFile(file);
        const nextData: Partial<UploadImageNodeData> = {
          ...toPreparedNodeImageFields(prepared),
          sourceFileName: file.name,
        };
        if (useUploadFilenameAsNodeTitle) {
          nextData.displayName = file.name;
        }
        updateNodeData(id, nextData);

        console.info(
          `[upload-perf][node] processFile success nodeId=${id} name="${file.name}" size=${file.size}B elapsed=${Math.round(performance.now() - started)}ms`
        );
      } catch (error) {
        if (uploadSequenceRef.current === sequence) {
          clearTransientPreview();
        }
        console.error(
          `[upload-perf][node] processFile failed nodeId=${id} name="${file.name}" size=${file.size}B elapsed=${Math.round(performance.now() - started)}ms`,
          error
        );
        throw error;
      }
    },
    [assetManifest, clearTransientPreview, commitAssetManifest, data.fileAssetId, data.imageUrl, id, projectId, updateNodeData, useUploadFilenameAsNodeTitle]
  );

  const {
    inputRef,
    fileInputAccept,
    openFilePicker,
    handleFileChange,
  } = useNodeAssetReplaceFileInput({
    nodeId: id,
    assetKind: 'image',
    imageUrl: data.imageUrl,
    fileAssetId: data.fileAssetId,
    onFileSelected: processFile,
  });

  const handleImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const perf = uploadPerfRef.current;
    if (!perf) {
      return;
    }

    const displayedSrc = event.currentTarget.currentSrc || event.currentTarget.src || '';
    const isTransient = displayedSrc.startsWith('blob:');
    const now = performance.now();

    if (isTransient && !perf.transientLoaded) {
      perf.transientLoaded = true;
      console.info(
        `[upload-perf][e2e] first-visible transient nodeId=${id} name="${perf.name}" size=${perf.size}B elapsed=${Math.round(now - perf.startedAt)}ms`
      );
      requestAnimationFrame(() => {
        const nextPerf = uploadPerfRef.current;
        if (!nextPerf || nextPerf.sequence !== perf.sequence) {
          return;
        }
        console.info(
          `[upload-perf][e2e] first-painted transient nodeId=${id} name="${nextPerf.name}" elapsed=${Math.round(performance.now() - nextPerf.startedAt)}ms`
        );
      });
      return;
    }

    if (!isTransient && !perf.stableLoaded) {
      perf.stableLoaded = true;
      console.info(
        `[upload-perf][e2e] stable-visible nodeId=${id} name="${perf.name}" size=${perf.size}B elapsed=${Math.round(now - perf.startedAt)}ms`
      );
      if (uploadSequenceRef.current === perf.sequence) {
        clearTransientPreview();
      }
      requestAnimationFrame(() => {
        const nextPerf = uploadPerfRef.current;
        if (!nextPerf || nextPerf.sequence !== perf.sequence) {
          return;
        }
        console.info(
          `[upload-perf][e2e] stable-painted nodeId=${id} name="${nextPerf.name}" elapsed=${Math.round(performance.now() - nextPerf.startedAt)}ms`
        );
      });
    }
  }, [clearTransientPreview, id]);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = resolveDroppedImageFile(event);
      if (!file || !file.type.startsWith('image/')) {
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
      if (!file.type.startsWith('image/')) {
        return;
      }
      void processFile(file);
    });
  }, [id, processFile]);

  const handleNodeClick = useCallback(() => {
    setSelectedNode(id);
    const mediaKind = data.mediaKind ?? (data.imageUrl ? 'image' : null);
    const hasBoundAsset = Boolean(data.imageUrl || transientPreviewUrl || data.textContent);
    if (!hasBoundAsset && (!mediaKind || mediaKind === 'image')) {
      openFilePicker();
    }
  }, [data.imageUrl, data.mediaKind, data.textContent, id, openFilePicker, setSelectedNode, transientPreviewUrl]);

  useEffect(() => () => {
    uploadPerfRef.current = null;
    clearTransientPreview();
  }, [clearTransientPreview]);

  const imageSource = useMemo(() => {
    if (transientPreviewUrl) {
      return transientPreviewUrl;
    }
    return resolveNodeImageDisplayUrl({
      imageUrl: data.imageUrl,
      fileAssetId: data.fileAssetId,
      preferOriginal: shouldUseOriginalImageByZoom(zoom),
    });
  }, [
    assetManifest,
    data.fileAssetId,
    data.imageUrl,
    transientPreviewUrl,
    zoom,
  ]);

  const resolvedMediaKind = data.mediaKind ?? (data.imageUrl ? 'image' : null);
  const assetMediaUrl = useMemo(() => {
    if (!resolvedMediaKind || resolvedMediaKind === 'text') {
      return '';
    }
    return resolveFileAssetDisplayUrl({
      projectId,
      fileAssetId: data.fileAssetId,
      imageUrl: data.imageUrl,
      assetManifest,
    });
  }, [assetManifest, data.fileAssetId, data.imageUrl, projectId, resolvedMediaKind]);

  const assetBinding = useMemo(
    () => ({
      imageUrl: data.imageUrl,
      fileAssetId: data.fileAssetId,
    }),
    [data.fileAssetId, data.imageUrl]
  );

  const hasMediaContent = Boolean(
    transientPreviewUrl
    || data.textContent
    || (resolvedMediaKind === 'image' && data.imageUrl)
    || (resolvedMediaKind && resolvedMediaKind !== 'image' && data.imageUrl)
  );

  useEffect(() => {
    if (resolvedMediaKind !== 'text' || data.textContent || !projectId || !data.imageUrl) {
      return;
    }

    let cancelled = false;
    const assetPath = data.imageUrl;

    void (async () => {
      const nextContent = await fetchAssetTextContent(projectId, assetPath);
      if (cancelled || nextContent === null) {
        return;
      }
      updateNodeData(id, { textContent: nextContent });
    })();

    return () => {
      cancelled = true;
    };
  }, [data.imageUrl, data.textContent, id, projectId, resolvedMediaKind, updateNodeData]);

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
        icon={<Upload className="h-4 w-4" />}
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
          mediaKind={resolvedMediaKind}
          assetBinding={assetBinding}
          assetMediaUrl={assetMediaUrl}
          imageSource={imageSource}
          imageViewerSourceUrl={resolveNodeImageDisplayUrl({
            imageUrl: data.imageUrl,
            fileAssetId: data.fileAssetId,
            preferOriginal: true,
          })}
          textContent={data.textContent}
          previewTitle={resolveMediaPreviewTitle(
            typeof data.sourceFileName === 'string' ? data.sourceFileName : null
          )}
          onImageLoad={handleImageLoad}
          nodeSelected={selected}
        />
      ) : (
        <label
          className="block h-full w-full overflow-hidden rounded-[var(--node-radius)] bg-bg-dark"
        >
          <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-text-muted/85">
            <Upload className="h-7 w-7 opacity-60" />
            <span className="px-3 text-center text-[12px] leading-6">点击或拖拽上传图片</span>
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
        minWidth={resizeMinWidth}
        minHeight={resizeMinHeight}
        maxWidth={1400}
        maxHeight={1400}
      />
    </div>
  );
});

UploadNode.displayName = 'UploadNode';
