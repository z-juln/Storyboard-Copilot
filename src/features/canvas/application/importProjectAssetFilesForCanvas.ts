import type { AssetManifest } from '@/features/project/asset';
import { importExternalFilesToDirectory } from '@/features/project/asset/projectAssetService';

import { notifyProjectAssetsImported } from './notifyProjectAssetsImported';

export async function importProjectAssetFilesForCanvas(input: {
  projectId: string;
  targetDirPath: string;
  files: File[];
  manifest: AssetManifest;
  reveal?: boolean;
}): Promise<{ manifest: AssetManifest; importedPaths: string[] }> {
  const result = await importExternalFilesToDirectory({
    projectId: input.projectId,
    targetDirPath: input.targetDirPath,
    files: input.files,
    manifest: input.manifest,
  });

  notifyProjectAssetsImported(result.importedPaths, { reveal: input.reveal ?? true });

  return result;
}
