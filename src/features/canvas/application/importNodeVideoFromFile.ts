import {
  findFileAssetIdByPath,
  type AssetManifest,
} from '@/features/project/asset';
import { resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

import { importProjectAssetFilesForCanvas } from './importProjectAssetFilesForCanvas';

export function isVideoUploadFile(file: File): boolean {
  if (file.type.startsWith('video/')) {
    return true;
  }
  return resolveAssetPreviewKind(file.name) === 'video';
}

export async function importNodeVideoFromFile(input: {
  projectId: string;
  file: File;
  manifest: AssetManifest;
}): Promise<{
  path: string;
  fileAssetId: string;
  manifest: AssetManifest;
}> {
  if (!isVideoUploadFile(input.file)) {
    throw new Error('只能上传视频文件');
  }

  const { manifest, importedPaths } = await importProjectAssetFilesForCanvas({
    projectId: input.projectId,
    targetDirPath: 'assets',
    files: [input.file],
    manifest: input.manifest,
  });

  const path = importedPaths[0];
  if (!path) {
    throw new Error('无法导入视频文件');
  }

  const fileAssetId = findFileAssetIdByPath(manifest, path);
  if (!fileAssetId) {
    throw new Error('视频资产注册失败');
  }

  return { path, fileAssetId, manifest };
}
