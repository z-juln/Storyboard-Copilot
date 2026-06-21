import { rustApiClient } from '@/infrastructure/rustApiClient';

import { getAssetBaseName } from './assetExplorerPathUtils';
import { normalizeAssetPath, registerFileAssetPath } from './assetManifest';
import {
  isReplacementFileCompatible,
  resolveReplaceableAssetKind,
  type ReplaceableAssetKind,
} from './assetReplaceUtils';
import type { AssetManifest } from './types';

export type { ReplaceableAssetKind } from './assetReplaceUtils';
export { isReplacementFileCompatible, resolveReplaceableAssetKind } from './assetReplaceUtils';

export async function replaceProjectAssetFile(input: {
  projectId: string;
  path: string;
  file: File | Blob;
  manifest: AssetManifest;
  /** 跳过类型校验（仅内部测试用） */
  skipTypeCheck?: boolean;
}): Promise<{ manifest: AssetManifest; updatedAt: number; fileAssetId: string }> {
  const normalizedPath = normalizeAssetPath(input.path);
  const targetFileName = getAssetBaseName(normalizedPath);
  const targetKind = resolveReplaceableAssetKind(targetFileName);
  if (!targetKind) {
    throw new Error('该文件类型不支持替换');
  }

  if (!input.skipTypeCheck && input.file instanceof File) {
    if (!isReplacementFileCompatible(targetFileName, input.file)) {
      throw new Error(targetKind === 'image' ? '只能使用图片文件替换' : '只能使用文本文件替换');
    }
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
  };
}

export function resolveReplaceFileAccept(kind: ReplaceableAssetKind): string {
  return kind === 'image' ? 'image/*' : '.txt,.md,.markdown,text/plain';
}
