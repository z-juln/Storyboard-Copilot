import { resolveAssetPreviewKind } from './assetPreviewUtils';

export type ReplaceableAssetKind = 'image' | 'text' | 'video' | 'audio';

export function resolveReplaceableAssetKind(fileName: string): ReplaceableAssetKind | null {
  const kind = resolveAssetPreviewKind(fileName.trim());
  if (kind === 'image' || kind === 'text' || kind === 'video' || kind === 'audio') {
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

  if (targetKind === 'audio') {
    return file.type.startsWith('audio/') || resolveAssetPreviewKind(file.name) === 'audio';
  }

  return file.type.startsWith('text/')
    || file.type === 'application/json'
    || file.type === 'application/xml';
}
