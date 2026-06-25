import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useUpdateNodeInternals } from '@xyflow/react';

import {
  EXPORT_RESULT_NODE_MIN_HEIGHT,
  EXPORT_RESULT_NODE_MIN_WIDTH,
  type NodeImageData,
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
import type { UploadMediaNodeConfig } from '@/features/canvas/nodes/uploadMediaNodeConfig';
import { resolveMediaPreviewTitle } from '@/features/canvas/ui/mediaPreviewShared';
import { useCanvasStore } from '@/stores/canvasStore';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { createEmptyAssetManifest, resolveFileAssetDisplayUrl } from '@/features/project/asset';

function resolveNodeDimension(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1) {
    return Math.round(value);
  }
  return fallback;
}

interface UseUploadMediaNodeOptions {
  id: string;
  data: NodeImageData & {
    sourceFileName?: string | null;
    mediaKind?: 'video' | 'audio' | null;
  };
  selected?: boolean;
  width?: number;
  height?: number;
  config: UploadMediaNodeConfig;
}

export function useUploadMediaNode({
  id,
  data,
  selected = false,
  width,
  height,
  config,
}: UseUploadMediaNodeOptions) {
  const updateNodeInternals = useUpdateNodeInternals();
  const setSelectedNode = useCanvasStore((state) => state.setSelectedNode);
  const updateNodeData = useCanvasStore((state) => state.updateNodeData);
  const projectId = useProjectStore((state) => state.currentProjectId);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);
  const useUploadFilenameAsNodeTitle = useSettingsStore((state) => state.useUploadFilenameAsNodeTitle);
  const uploadSequenceRef = useRef(0);
  const [transientPreviewUrl, setTransientPreviewUrl] = useState<string | null>(null);

  const resolvedAspectRatio = data.aspectRatio || config.defaultAspectRatio;
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
      && isNodeUsingDefaultDisplayName(config.nodeType, data)
    ) {
      return sourceFileName;
    }

    return resolveNodeDisplayName(config.nodeType, data);
  }, [config.nodeType, data, useUploadFilenameAsNodeTitle]);

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
        throw new Error(`未打开项目，无法上传${config.uploadLabel}`);
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

        if (!config.isValidFile(file)) {
          throw new Error(`只能上传${config.uploadLabel}文件`);
        }

        const manifest = assetManifest ?? createEmptyAssetManifest();
        const imported = await config.importFromFile({
          projectId,
          file,
          manifest,
        });
        commitAssetManifest(imported.manifest);

        const nextData: Partial<NodeImageData> & {
          sourceFileName?: string;
          mediaKind?: 'video' | 'audio';
        } = {
          imageUrl: imported.path,
          fileAssetId: imported.fileAssetId,
          sourceFileName: file.name,
          mediaKind: config.mediaKind,
          aspectRatio: config.defaultAspectRatio,
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
        console.error(`[${config.logTag}] processFile failed`, error);
        throw error;
      }
    },
    [
      assetManifest,
      clearTransientPreview,
      commitAssetManifest,
      config,
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
    assetKind: config.mediaKind,
    imageUrl: data.imageUrl,
    fileAssetId: data.fileAssetId,
    onFileSelected: processFile,
  });

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const file = event.dataTransfer.files?.[0];
      if (!file || !config.isValidFile(file)) {
        return;
      }

      await processFile(file);
    },
    [config, processFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    return subscribeUploadNodePasteImage(id, (file) => {
      if (!config.isValidFile(file)) {
        return;
      }
      void processFile(file);
    });
  }, [config, id, processFile]);

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
  const previewTitle = resolveMediaPreviewTitle(
    typeof data.sourceFileName === 'string' ? data.sourceFileName : null,
    config.previewFallbackTitle
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, resolvedHeight, resolvedWidth, updateNodeInternals]);

  const shellClassName = selected
    ? 'border-2 border-accent p-1.5 shadow-[0_0_0_2px_rgba(59,130,246,0.62),0_0_0_4px_rgba(8,12,22,0.96),0_0_24px_rgba(59,130,246,0.34)]'
    : 'border border-[rgba(15,23,42,0.22)] p-0 hover:border-[rgba(15,23,42,0.34)] dark:border-[rgba(255,255,255,0.22)] dark:hover:border-[rgba(255,255,255,0.34)]';

  return {
    config,
    resolvedTitle,
    resolvedWidth,
    resolvedHeight,
    resizeConstraints,
    shellClassName,
    hasMediaContent,
    assetBinding,
    assetMediaUrl,
    previewTitle,
    inputRef,
    fileInputAccept,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleNodeClick,
    updateNodeData,
  };
}
