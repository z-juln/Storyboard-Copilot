import type { CanvasNode } from '@/stores/canvasStore';

import { isNodeProjectAssetBound } from './nodeAssetBinding';
import { refreshCanvasNodesAfterAssetReplace } from './refreshNodesAfterAssetReplace';
import { isTextNode, isUploadNode } from '@/features/canvas/domain/canvasNodes';
import {
  getAssetBaseName,
  normalizeAssetPath,
} from '@/features/project/asset';
import {
  isReplacementFileCompatible,
  replaceProjectAssetFile,
  resolveReplaceableAssetKind,
  resolveReplaceFileAccept,
  type ReplaceableAssetKind,
} from '@/features/project/asset/replaceProjectAssetFile';
import { isProjectRelativeAssetPath } from '@/features/project/projectPaths';
import type { AssetManifest } from '@/features/project/asset/types';

export type NodeAssetFileKind = 'image' | 'text';

export function resolveNodeAssetFileKind(node: CanvasNode): NodeAssetFileKind | null {
  if (isUploadNode(node)) {
    return 'image';
  }
  if (isTextNode(node)) {
    return 'text';
  }
  return null;
}

export function resolveBoundProjectAssetPath(input: {
  imageUrl?: unknown;
}): string | null {
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  if (!imageUrl || !isProjectRelativeAssetPath(imageUrl)) {
    return null;
  }
  return normalizeAssetPath(imageUrl);
}

export function canNodeReplaceBoundAsset(node: CanvasNode): boolean {
  if (!resolveNodeAssetFileKind(node)) {
    return false;
  }
  const data = node.data as { imageUrl?: unknown; fileAssetId?: unknown };
  const assetPath = resolveBoundProjectAssetPath(data);
  if (!assetPath) {
    return false;
  }
  return isNodeProjectAssetBound({
    imageUrl: assetPath,
    fileAssetId: typeof data.fileAssetId === 'string' ? data.fileAssetId : null,
  });
}

export function resolveNodeAssetFileInputAccept(input: {
  assetKind: NodeAssetFileKind;
  imageUrl?: string | null;
  fileAssetId?: string | null;
}): string {
  const assetPath = typeof input.imageUrl === 'string' && isProjectRelativeAssetPath(input.imageUrl.trim())
    ? input.imageUrl.trim()
    : null;

  if (
    assetPath
    && isNodeProjectAssetBound({ imageUrl: assetPath, fileAssetId: input.fileAssetId })
  ) {
    const kind = resolveReplaceableAssetKind(getAssetBaseName(assetPath));
    if (kind) {
      return resolveReplaceFileAccept(kind);
    }
  }

  return input.assetKind === 'image' ? 'image/*' : resolveReplaceFileAccept('text');
}

function resolveReplacementErrorMessage(
  targetKind: ReplaceableAssetKind | null
): string {
  if (targetKind === 'text') {
    return '只能使用文本文件替换';
  }
  if (targetKind === 'image') {
    return '只能使用图片文件替换';
  }
  return '该绑定文件不支持替换';
}

export async function replaceBoundNodeAssetIfNeeded(input: {
  projectId: string | null;
  assetManifest: AssetManifest | undefined;
  commitAssetManifest: (manifest: AssetManifest) => void;
  imageUrl?: string | null;
  fileAssetId?: string | null;
  file: File;
}): Promise<boolean> {
  const assetPath = typeof input.imageUrl === 'string' && isProjectRelativeAssetPath(input.imageUrl.trim())
    ? normalizeAssetPath(input.imageUrl.trim())
    : null;

  const isBoundProjectAsset = Boolean(
    input.projectId
    && input.assetManifest
    && assetPath
    && isNodeProjectAssetBound({
      imageUrl: assetPath,
      fileAssetId: input.fileAssetId,
    })
  );

  if (!isBoundProjectAsset || !assetPath || !input.projectId || !input.assetManifest) {
    return false;
  }

  const targetFileName = getAssetBaseName(assetPath);
  const targetKind = resolveReplaceableAssetKind(targetFileName);
  if (!targetKind || !isReplacementFileCompatible(targetFileName, input.file)) {
    throw new Error(resolveReplacementErrorMessage(targetKind));
  }

  const result = await replaceProjectAssetFile({
    projectId: input.projectId,
    path: assetPath,
    file: input.file,
    manifest: input.assetManifest,
  });
  input.commitAssetManifest(result.manifest);
  await refreshCanvasNodesAfterAssetReplace({
    projectId: input.projectId,
    path: assetPath,
    fileAssetId: result.fileAssetId,
    updatedAt: result.updatedAt,
    kind: targetKind,
  });
  return true;
}
