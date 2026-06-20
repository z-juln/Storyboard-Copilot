import type { XYPosition } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import type { AssetManifest } from '@/features/project/asset';
import { createEmptyAssetManifest } from '@/features/project/asset';
import { createProjectAssetFile } from '@/features/project/asset/projectAssetService';

import type { CanvasNodePlacementDeps } from './canvasNodePlacement';
import { placeBoundTextNodeOnCanvas } from './canvasNodePlacement';

export interface CreateTextNodeWithAssetOnCanvasInput extends CanvasNodePlacementDeps {
  projectId: string;
  position: XYPosition;
  assetManifest?: AssetManifest | null;
  commitAssetManifest: (manifest: AssetManifest) => void;
}

function createUniqueTextAssetFileName(): string {
  return `text-${uuidv4().slice(0, 8)}.txt`;
}

export async function createTextNodeWithAssetOnCanvas(
  input: CreateTextNodeWithAssetOnCanvasInput
): Promise<string> {
  const manifest = input.assetManifest ?? createEmptyAssetManifest();
  const fileName = createUniqueTextAssetFileName();

  const created = await createProjectAssetFile({
    projectId: input.projectId,
    parentDirPath: 'assets',
    name: fileName,
    manifest,
  });

  input.commitAssetManifest(created.manifest);

  return placeBoundTextNodeOnCanvas({
    projectId: input.projectId,
    position: input.position,
    path: created.path,
    name: fileName,
    manifest: created.manifest,
    addNode: input.addNode,
    setSelectedNode: input.setSelectedNode,
    markAssetPathsAvailable: input.markAssetPathsAvailable,
  });
}
