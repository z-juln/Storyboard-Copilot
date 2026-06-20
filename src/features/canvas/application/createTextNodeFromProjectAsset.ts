import type { TextNodeData } from '@/features/canvas/domain/canvasNodes';
import {
  findFileAssetIdByPath,
  registerFileAssetPath,
  type AssetManifest,
} from '@/features/project/asset';
import { fetchAssetTextContent } from '@/features/project/asset/assetPreviewUtils';

export async function buildTextNodeDataFromProjectAsset(input: {
  projectId: string;
  path: string;
  name: string;
  manifest: AssetManifest;
}): Promise<{
  nodeData: Partial<TextNodeData>;
  manifest: AssetManifest;
  manifestChanged: boolean;
}> {
  let manifest = input.manifest;
  let manifestChanged = false;

  let fileAssetId = findFileAssetIdByPath(manifest, input.path);
  if (!fileAssetId) {
    const registered = registerFileAssetPath(manifest, input.path);
    manifest = registered.manifest;
    fileAssetId = registered.fileAssetId;
    manifestChanged = registered.created;
  }

  const record = manifest[fileAssetId];
  const textContent = await fetchAssetTextContent(input.projectId, input.path);

  const nodeData: Partial<TextNodeData> = {
    imageUrl: input.path,
    fileAssetId,
    sourceFileName: input.name,
    displayName: input.name,
    textContent: textContent ?? '',
    textSyncedAt: record?.updatedAt ?? Date.now(),
  };

  return { nodeData, manifest, manifestChanged };
}
