import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

import type {
  UploadAudioNodeData,
  UploadVideoNodeData,
} from '@/features/canvas/domain/canvasNodes';
import { useUploadMediaNode } from '@/features/canvas/hooks/useUploadMediaNode';
import { NodeAssetBindingMeta } from '@/features/canvas/ui/NodeAssetBindingMeta';
import { NodeHeader, NODE_HEADER_FLOATING_POSITION_CLASS } from '@/features/canvas/ui/NodeHeader';
import { NodeResizeHandle } from '@/features/canvas/ui/NodeResizeHandle';
import { UploadNodeMediaBody } from '@/features/canvas/nodes/UploadNodeMediaBody';
import {
  UPLOAD_MEDIA_NODE_CONFIG,
  type UploadMediaNodeConfig,
} from '@/features/canvas/nodes/uploadMediaNodeConfig';
import type { UploadMediaFileKind } from '@/features/canvas/application/importNodeMediaFromFile';

type UploadMediaNodeProps = NodeProps & {
  id: string;
  selected?: boolean;
};

function UploadMediaNodeView({
  id,
  data,
  selected,
  width,
  height,
  config,
}: UploadMediaNodeProps & {
  config: UploadMediaNodeConfig;
  data: UploadVideoNodeData | UploadAudioNodeData;
}) {
  const {
    config: mediaConfig,
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
  } = useUploadMediaNode({
    id,
    data,
    selected,
    width,
    height,
    config,
  });

  const HeaderIcon = mediaConfig.HeaderIcon;
  const EmptyIcon = mediaConfig.EmptyIcon;

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
        icon={<HeaderIcon className="h-4 w-4" />}
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
          mediaKind={mediaConfig.mediaKind}
          assetBinding={assetBinding}
          assetMediaUrl={assetMediaUrl}
          imageSource={null}
          imageViewerSourceUrl={null}
          textContent={null}
          previewTitle={previewTitle}
          onImageLoad={() => {}}
          nodeSelected={selected}
        />
      ) : (
        <label className="block h-full w-full overflow-hidden rounded-[var(--node-radius)] bg-bg-dark">
          <div className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-text-muted/85">
            <EmptyIcon className="h-7 w-7 opacity-60" />
            <span className="px-3 text-center text-[12px] leading-6">{mediaConfig.emptyUploadHint}</span>
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
}

function createUploadMediaNode(kind: UploadMediaFileKind) {
  const config = UPLOAD_MEDIA_NODE_CONFIG[kind];
  const Component = memo((props: UploadMediaNodeProps & { data: UploadVideoNodeData | UploadAudioNodeData }) => (
    <UploadMediaNodeView {...props} config={config} />
  ));
  Component.displayName = kind === 'video' ? 'UploadVideoNode' : 'UploadAudioNode';
  return Component;
}

export const UploadVideoNode = createUploadMediaNode('video');
export const UploadAudioNode = createUploadMediaNode('audio');
