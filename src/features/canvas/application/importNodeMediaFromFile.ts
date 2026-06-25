import {
  findFileAssetIdByPath,
  type AssetManifest,
} from '@/features/project/asset';
import { resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

import { importProjectAssetFilesForCanvas } from './importProjectAssetFilesForCanvas';

export type UploadMediaFileKind = 'video' | 'audio';

const MEDIA_LABEL: Record<UploadMediaFileKind, string> = {
  video: '视频',
  audio: '音频',
};

export function isMediaUploadFile(file: File, kind: UploadMediaFileKind): boolean {
  if (kind === 'video') {
    if (file.type.startsWith('video/')) {
      return true;
    }
    return resolveAssetPreviewKind(file.name) === 'video';
  }

  if (file.type.startsWith('audio/')) {
    return true;
  }
  return resolveAssetPreviewKind(file.name) === 'audio';
}

export function isVideoUploadFile(file: File): boolean {
  return isMediaUploadFile(file, 'video');
}

export function isAudioUploadFile(file: File): boolean {
  return isMediaUploadFile(file, 'audio');
}

export async function importNodeMediaFromFile(input: {
  projectId: string;
  file: File;
  manifest: AssetManifest;
  kind: UploadMediaFileKind;
}): Promise<{
  path: string;
  fileAssetId: string;
  manifest: AssetManifest;
}> {
  const label = MEDIA_LABEL[input.kind];

  if (!isMediaUploadFile(input.file, input.kind)) {
    throw new Error(`只能上传${label}文件`);
  }

  const { manifest, importedPaths } = await importProjectAssetFilesForCanvas({
    projectId: input.projectId,
    targetDirPath: 'assets',
    files: [input.file],
    manifest: input.manifest,
  });

  const path = importedPaths[0];
  if (!path) {
    throw new Error(`无法导入${label}文件`);
  }

  const fileAssetId = findFileAssetIdByPath(manifest, path);
  if (!fileAssetId) {
    throw new Error(`${label}资产注册失败`);
  }

  return { path, fileAssetId, manifest };
}

export function importNodeVideoFromFile(input: {
  projectId: string;
  file: File;
  manifest: AssetManifest;
}) {
  return importNodeMediaFromFile({ ...input, kind: 'video' });
}

export function importNodeAudioFromFile(input: {
  projectId: string;
  file: File;
  manifest: AssetManifest;
}) {
  return importNodeMediaFromFile({ ...input, kind: 'audio' });
}
