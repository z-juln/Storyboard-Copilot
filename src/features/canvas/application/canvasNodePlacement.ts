import type { XYPosition } from '@xyflow/react';

import { notifyProjectAssetsImported } from '@/features/canvas/application/notifyProjectAssetsImported';
import { CANVAS_NODE_TYPES, type CanvasNodeType } from '@/features/canvas/domain/canvasNodes';
import type { AssetManifest } from '@/features/project/asset';

import { buildTextNodeDataFromProjectAsset } from './createTextNodeFromProjectAsset';
import type { NodeLayoutSize } from './textNodeSizing';
import { resolveTextNodeInitialSize } from './textNodeSizing';

/** 画布落点创建节点时注入的 store 能力（避免应用层直接 import store）。 */
export interface CanvasNodePlacementDeps {
  addNode: (
    type: CanvasNodeType,
    position: XYPosition,
    data?: Record<string, unknown>,
    layout?: NodeLayoutSize
  ) => string;
  setSelectedNode: (nodeId: string) => void;
  markAssetPathsAvailable: (paths: string[]) => void;
}

export interface PlaceBoundTextNodeOnCanvasInput extends CanvasNodePlacementDeps {
  projectId: string;
  position: XYPosition;
  path: string;
  name: string;
  manifest: AssetManifest;
  /** 当 build 过程中新注册了 manifest 条目时调用 */
  commitAssetManifest?: (manifest: AssetManifest) => void;
}

export async function placeBoundTextNodeOnCanvas(
  input: PlaceBoundTextNodeOnCanvasInput
): Promise<string> {
  const { nodeData, manifest, manifestChanged } = await buildTextNodeDataFromProjectAsset({
    projectId: input.projectId,
    path: input.path,
    name: input.name,
    manifest: input.manifest,
  });

  if (manifestChanged) {
    input.commitAssetManifest?.(manifest);
  }

  notifyProjectAssetsImported([input.path]);

  const layout = resolveTextNodeInitialSize(nodeData.textContent ?? '');
  const nodeId = input.addNode(CANVAS_NODE_TYPES.text, input.position, nodeData, layout);
  input.setSelectedNode(nodeId);
  return nodeId;
}
