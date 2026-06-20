import type { XYPosition } from '@xyflow/react';

import { CANVAS_NODE_TYPES, type CanvasNodeType } from '@/features/canvas/domain/canvasNodes';
import type { AssetManifest } from '@/features/project/asset';
import { createEmptyAssetManifest } from '@/features/project/asset';

import {
  buildUploadNodeDataFromProjectAsset,
  type ProjectAssetDragPayload,
} from './createUploadNodeFromProjectAsset';

export interface DropProjectAssetOnCanvasInput {
  projectId: string;
  payload: ProjectAssetDragPayload;
  position: XYPosition;
  assetManifest?: AssetManifest | null;
  commitAssetManifest: (manifest: AssetManifest) => void;
  addNode: (
    type: CanvasNodeType,
    position: XYPosition,
    data?: Record<string, unknown>
  ) => string;
  setSelectedNode: (nodeId: string) => void;
}

export async function dropProjectAssetOnCanvas(
  input: DropProjectAssetOnCanvasInput
): Promise<string> {
  const { nodeData, manifest, manifestChanged } = await buildUploadNodeDataFromProjectAsset({
    projectId: input.projectId,
    path: input.payload.path,
    name: input.payload.name,
    mediaKind: input.payload.mediaKind,
    manifest: input.assetManifest ?? createEmptyAssetManifest(),
  });

  if (manifestChanged) {
    input.commitAssetManifest(manifest);
  }

  const nodeId = input.addNode(CANVAS_NODE_TYPES.upload, input.position, nodeData);
  input.setSelectedNode(nodeId);
  return nodeId;
}
