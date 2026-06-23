import type { AssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';
import { resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

export type GitChangePreviewKind = AssetPreviewKind | 'text';

export function resolveGitChangePreviewKind(path: string): GitChangePreviewKind | null {
  if (path === 'project.json') {
    return 'text';
  }
  const fileName = path.split('/').pop() ?? path;
  if (!fileName || path.endsWith('/')) {
    return null;
  }
  return resolveAssetPreviewKind(fileName);
}

export function isGitChangeDiffable(path: string): boolean {
  return resolveGitChangePreviewKind(path) !== null;
}

export function resolveGitBlobMime(path: string, kind: GitChangePreviewKind): string {
  const fileName = path.split('/').pop() ?? path;
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';

  if (kind === 'image') {
    const imageMime: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      avif: 'image/avif',
    };
    return imageMime[ext] ?? 'image/png';
  }
  if (kind === 'video') {
    const videoMime: Record<string, string> = {
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      m4v: 'video/mp4',
      mkv: 'video/x-matroska',
      ogv: 'video/ogg',
    };
    return videoMime[ext] ?? 'video/mp4';
  }
  if (kind === 'audio') {
    const audioMime: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      flac: 'audio/flac',
      opus: 'audio/opus',
    };
    return audioMime[ext] ?? 'audio/mpeg';
  }
  return 'text/plain';
}

export function canDiffGitChange(
  change: { path: string; kind: string },
  headCommit: string | null | undefined
): boolean {
  if (!isGitChangeDiffable(change.path)) {
    return false;
  }
  if (change.kind === 'added') {
    return true;
  }
  return Boolean(headCommit);
}
