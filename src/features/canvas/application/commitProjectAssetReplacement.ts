import {
  replaceProjectAssetFile,
  type AssetManifest,
  type ReplaceableAssetKind,
} from '@/features/project/asset';

import { refreshCanvasNodesAfterAssetReplace } from './refreshNodesAfterAssetReplace';

export async function commitProjectAssetReplacement(input: {
  projectId: string;
  path: string;
  file: File | Blob;
  manifest: AssetManifest;
  commitAssetManifest: (manifest: AssetManifest) => void;
}): Promise<{
  manifest: AssetManifest;
  fileAssetId: string;
  updatedAt: number;
  kind: ReplaceableAssetKind;
}> {
  const result = await replaceProjectAssetFile({
    projectId: input.projectId,
    path: input.path,
    file: input.file,
    manifest: input.manifest,
  });

  input.commitAssetManifest(result.manifest);
  await refreshCanvasNodesAfterAssetReplace({
    projectId: input.projectId,
    path: input.path,
    fileAssetId: result.fileAssetId,
    updatedAt: result.updatedAt,
    kind: result.kind,
  });

  return result;
}
