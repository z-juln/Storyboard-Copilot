import { rustApiClient } from '@/infrastructure/rustApiClient';

import { getAssetBaseName } from './assetExplorerPathUtils';
import { normalizeAssetPath, registerFileAssetPath } from './assetManifest';
import {
  isReplacementFileCompatible,
  resolveReplaceableAssetKind,
  type ReplaceableAssetKind,
} from './assetReplaceUtils';
import type { AssetManifest } from './types';

export async function replaceProjectAssetFile(input: {
  projectId: string;
  path: string;
  file: File | Blob;
  manifest: AssetManifest;
}): Promise<{
  manifest: AssetManifest;
  updatedAt: number;
  fileAssetId: string;
  kind: ReplaceableAssetKind;
}> {
  const normalizedPath = normalizeAssetPath(input.path);
  const targetFileName = getAssetBaseName(normalizedPath);
  const targetKind = resolveReplaceableAssetKind(targetFileName);
  if (!targetKind) {
    throw new Error('该文件类型不支持替换');
  }

  if (input.file instanceof File && !isReplacementFileCompatible(targetFileName, input.file)) {
    const message = targetKind === 'image'
      ? '只能使用图片文件替换'
      : targetKind === 'video'
        ? '只能使用视频文件替换'
        : targetKind === 'audio'
          ? '只能使用音频文件替换'
          : '只能使用文本文件替换';
    throw new Error(message);
  }

  if (input.file instanceof File) {
    await rustApiClient.uploadProjectAssetAtPathInChunks(input.projectId, normalizedPath, input.file);
  } else {
    await rustApiClient.putProjectAssetAtPath(input.projectId, normalizedPath, input.file);
  }

  const updatedAt = Date.now();
  const registered = registerFileAssetPath(input.manifest, normalizedPath, { updatedAt });
  return {
    manifest: registered.manifest,
    updatedAt,
    fileAssetId: registered.fileAssetId,
    kind: targetKind,
  };
}

export function resolveReplaceFileAccept(kind: ReplaceableAssetKind): string {
  if (kind === 'image') {
    return 'image/*';
  }
  if (kind === 'video') {
    return 'video/*';
  }
  if (kind === 'audio') {
    return 'audio/*';
  }
  return '.txt,.md,.markdown,text/plain';
}
