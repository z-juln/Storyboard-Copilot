import type { CanvasNode } from '@/stores/canvasStore';

import { commitProjectAssetReplacement } from './commitProjectAssetReplacement';
import { isNodeProjectAssetBound, resolveBoundProjectAssetPath } from './nodeAssetBinding';
import { isTextNode, isUploadNode, isUploadVideoNode, isUploadAudioNode } from '@/features/canvas/domain/canvasNodes';
import {
  getAssetBaseName,
  resolveReplaceableAssetKind,
  resolveReplaceFileAccept,
} from '@/features/project/asset';
import type { AssetManifest } from '@/features/project/asset/types';

export type NodeAssetFileKind = 'image' | 'text' | 'video' | 'audio';

export function resolveNodeAssetFileKind(node: CanvasNode): NodeAssetFileKind | null {
  if (isUploadNode(node)) {
    return 'image';
  }
  if (isUploadVideoNode(node)) {
    return 'video';
  }
  if (isUploadAudioNode(node)) {
    return 'audio';
  }
  if (isTextNode(node)) {
    return 'text';
  }
  return null;
}

export function canNodeReplaceBoundAsset(node: CanvasNode): boolean {
  if (!resolveNodeAssetFileKind(node)) {
    return false;
  }
  const data = node.data as { imageUrl?: unknown; fileAssetId?: unknown };
  const assetPath = resolveBoundProjectAssetPath(data.imageUrl);
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
  const assetPath = resolveBoundProjectAssetPath(input.imageUrl);

  if (
    assetPath
    && isNodeProjectAssetBound({ imageUrl: assetPath, fileAssetId: input.fileAssetId })
  ) {
    const kind = resolveReplaceableAssetKind(getAssetBaseName(assetPath));
    if (kind) {
      return resolveReplaceFileAccept(kind);
    }
  }

  return input.assetKind === 'image'
    ? 'image/*'
    : input.assetKind === 'video'
      ? 'video/*'
      : input.assetKind === 'audio'
        ? 'audio/*'
        : resolveReplaceFileAccept('text');
}

export async function replaceBoundNodeAssetIfNeeded(input: {
  projectId: string | null;
  assetManifest: AssetManifest | undefined;
  commitAssetManifest: (manifest: AssetManifest) => void;
  imageUrl?: string | null;
  fileAssetId?: string | null;
  file: File;
}): Promise<boolean> {
  const assetPath = resolveBoundProjectAssetPath(input.imageUrl);

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

  await commitProjectAssetReplacement({
    projectId: input.projectId,
    path: assetPath,
    file: input.file,
    manifest: input.assetManifest,
    commitAssetManifest: input.commitAssetManifest,
  });
  return true;
}
