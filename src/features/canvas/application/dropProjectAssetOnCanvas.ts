import type { XYPosition } from '@xyflow/react';

import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import { CANVAS_NODE_TYPES, type CanvasNodeType } from '@/features/canvas/domain/canvasNodes';
import type { AssetManifest } from '@/features/project/asset';
import { createEmptyAssetManifest } from '@/features/project/asset';
import { isBindableTextAssetFileName } from '@/features/project/asset/assetPreviewUtils';

import type { CanvasNodePlacementDeps } from './canvasNodePlacement';
import { placeBoundTextNodeOnCanvas } from './canvasNodePlacement';
import type { NodeLayoutSize } from './textNodeSizing';
import {
  buildUploadNodeDataFromProjectAsset,
  type ProjectAssetDragPayload,
} from './createUploadNodeFromProjectAsset';

export interface DropProjectAssetOnCanvasInput extends CanvasNodePlacementDeps {
  projectId: string;
  payload: ProjectAssetDragPayload;
  position: XYPosition;
  assetManifest?: AssetManifest | null;
  commitAssetManifest: (manifest: AssetManifest) => void;
  addNode: (
    type: CanvasNodeType,
    position: XYPosition,
    data?: Record<string, unknown>,
    layout?: NodeLayoutSize
  ) => string;
}

export async function dropProjectAssetOnCanvas(
  input: DropProjectAssetOnCanvasInput
): Promise<string> {
  const isTextAsset =
    input.payload.mediaKind === 'text'
    && isBindableTextAssetFileName(input.payload.name);

  const manifest = input.assetManifest ?? createEmptyAssetManifest();

  if (isTextAsset) {
    return placeBoundTextNodeOnCanvas({
      projectId: input.projectId,
      position: input.position,
      path: input.payload.path,
      name: input.payload.name,
      manifest,
      commitAssetManifest: input.commitAssetManifest,
      addNode: input.addNode,
      setSelectedNode: input.setSelectedNode,
      markAssetPathsAvailable: input.markAssetPathsAvailable,
    });
  }

  const { nodeData, manifest: nextManifest, manifestChanged } =
    await buildUploadNodeDataFromProjectAsset({
      projectId: input.projectId,
      path: input.payload.path,
      name: input.payload.name,
      mediaKind: input.payload.mediaKind,
      manifest,
    });

  if (manifestChanged) {
    input.commitAssetManifest(nextManifest);
  }

  input.markAssetPathsAvailable([input.payload.path]);

  const nodeId = input.addNode(CANVAS_NODE_TYPES.upload, input.position, nodeData);
  input.setSelectedNode(nodeId);
  canvasEventBus.publish('asset-explorer/reveal-asset', { path: input.payload.path });
  return nodeId;
}
