import { resolveRustApiBaseUrl } from '@/infrastructure/rustApiClient';

const ASSET_PREFIX = 'assets/';

export function isProjectRelativeAssetPath(imageUrl: string | null | undefined): boolean {
  if (typeof imageUrl !== 'string') {
    return false;
  }
  const trimmed = imageUrl.trim();
  return trimmed.startsWith(ASSET_PREFIX) && !trimmed.includes('..');
}

export function isRemoteImageUrl(imageUrl: string | null | undefined): boolean {
  if (typeof imageUrl !== 'string') {
    return false;
  }
  const lower = imageUrl.trim().toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

export function buildProjectAssetUrl(projectId: string, relativePath: string): string {
  const normalized = relativePath.trim().replace(/^\/+/, '');
  return `${resolveRustApiBaseUrl()}/api/v1/projects/${encodeURIComponent(projectId)}/assets?path=${encodeURIComponent(normalized)}`;
}

export const DEFAULT_PREVIEW_MAX_DIMENSION = 512;

export function buildProjectAssetPreviewUrl(
  projectId: string,
  relativePath: string,
  maxDimension = DEFAULT_PREVIEW_MAX_DIMENSION
): string {
  const normalized = relativePath.trim().replace(/^\/+/, '');
  const safeMax = Math.max(64, Math.min(4096, Math.floor(maxDimension)));
  return `${resolveRustApiBaseUrl()}/api/v1/projects/${encodeURIComponent(projectId)}/assets/preview?path=${encodeURIComponent(normalized)}&max=${safeMax}`;
}

export function resolveProjectImageDisplayUrl(
  projectId: string | null | undefined,
  imageUrl: string | null | undefined,
  resolveAbsolutePath: (absolutePath: string) => string
): string {
  if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
    return '';
  }

  if (isRemoteImageUrl(imageUrl)) {
    return imageUrl;
  }

  if (projectId && isProjectRelativeAssetPath(imageUrl)) {
    return buildProjectAssetUrl(projectId, imageUrl);
  }

  return resolveAbsolutePath(imageUrl);
}
