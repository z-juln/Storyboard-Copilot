import type { XYPosition } from '@xyflow/react';

import { publishUploadNodePasteImage } from '@/features/canvas/application/uploadNodePasteBridge';
import { CANVAS_NODE_TYPES, type CanvasNodeType } from '@/features/canvas/domain/canvasNodes';
import type { AssetManifest } from '@/features/project/asset';
import { createEmptyAssetManifest } from '@/features/project/asset';
import { importExternalFilesToDirectory } from '@/features/project/asset/projectAssetService';
import { isBindableTextAssetFileName } from '@/features/project/asset/assetPreviewUtils';

import type { CanvasNodePlacementDeps } from './canvasNodePlacement';
import { placeBoundTextNodeOnCanvas } from './canvasNodePlacement';
import type { NodeLayoutSize } from './textNodeSizing';

export interface DropExternalFileOnCanvasInput extends CanvasNodePlacementDeps {
  projectId: string;
  file: File;
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

export async function dropExternalFileOnCanvas(
  input: DropExternalFileOnCanvasInput
): Promise<string> {
  if (isBindableTextAssetFileName(input.file.name)) {
    const manifest = input.assetManifest ?? createEmptyAssetManifest();
    const { manifest: nextManifest, importedPaths } = await importExternalFilesToDirectory({
      projectId: input.projectId,
      targetDirPath: 'assets',
      files: [input.file],
      manifest,
    });
    input.commitAssetManifest(nextManifest);

    const path = importedPaths[0];
    if (!path) {
      throw new Error('无法导入文本文件');
    }

    return placeBoundTextNodeOnCanvas({
      projectId: input.projectId,
      position: input.position,
      path,
      name: input.file.name,
      manifest: nextManifest,
      addNode: input.addNode,
      setSelectedNode: input.setSelectedNode,
      markAssetPathsAvailable: input.markAssetPathsAvailable,
    });
  }

  if (input.file.type.startsWith('image/')) {
    const nodeId = input.addNode(CANVAS_NODE_TYPES.upload, input.position, {});
    input.setSelectedNode(nodeId);
    publishUploadNodePasteImage(nodeId, input.file);
    return nodeId;
  }

  throw new Error('不支持的文件类型');
}
