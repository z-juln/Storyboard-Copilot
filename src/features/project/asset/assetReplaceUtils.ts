import { resolveAssetPreviewKind } from './assetPreviewUtils';

export type ReplaceableAssetKind = 'image' | 'text' | 'video';

export function resolveReplaceableAssetKind(fileName: string): ReplaceableAssetKind | null {
  const kind = resolveAssetPreviewKind(fileName.trim());
  if (kind === 'image' || kind === 'text' || kind === 'video') {
    return kind;
  }
  return null;
}

export function isReplacementFileCompatible(targetFileName: string, file: File): boolean {
  const targetKind = resolveReplaceableAssetKind(targetFileName);
  if (!targetKind) {
    return false;
  }

  const sourceKind = resolveReplaceableAssetKind(file.name);
  if (sourceKind === targetKind) {
    return true;
  }

  if (targetKind === 'image') {
    return file.type.startsWith('image/');
  }

  if (targetKind === 'video') {
    return file.type.startsWith('video/') || resolveAssetPreviewKind(file.name) === 'video';
  }

  return file.type.startsWith('text/')
    || file.type === 'application/json'
    || file.type === 'application/xml';
}
