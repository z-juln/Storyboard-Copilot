import {
  buildProjectAssetPreviewUrl,
  buildProjectAssetUrl,
  DEFAULT_PREVIEW_MAX_DIMENSION,
  isProjectRelativeAssetPath,
  isRemoteImageUrl,
} from '@/features/project/projectPaths';

import { resolveManifestPath } from './assetManifest';
import type { AssetManifest } from './types';

export function resolveFileAssetDisplayUrl(input: {
  projectId: string | null | undefined;
  fileAssetId?: string | null;
  imageUrl?: string | null;
  assetManifest?: AssetManifest | null;
  resolveAbsolutePath?: (absolutePath: string) => string;
  preferPreview?: boolean;
  maxPreviewDimension?: number;
}): string {
  const {
    projectId,
    fileAssetId,
    imageUrl,
    assetManifest,
    resolveAbsolutePath,
    preferPreview = false,
    maxPreviewDimension = DEFAULT_PREVIEW_MAX_DIMENSION,
  } = input;

  if (typeof imageUrl === 'string' && isRemoteImageUrl(imageUrl)) {
    return imageUrl;
  }

  const manifestPath = resolveManifestPath(assetManifest ?? {}, fileAssetId);
  const path = manifestPath ?? (typeof imageUrl === 'string' ? imageUrl.trim() : '');
  if (!path) {
    return '';
  }

  if (projectId && isProjectRelativeAssetPath(path)) {
    if (preferPreview) {
      return buildProjectAssetPreviewUrl(projectId, path, maxPreviewDimension);
    }
    const record = fileAssetId ? assetManifest?.[fileAssetId] : undefined;
    const base = buildProjectAssetUrl(projectId, path);
    if (record?.updatedAt) {
      return `${base}&v=${record.updatedAt}`;
    }
    return base;
  }

  if (resolveAbsolutePath) {
    return resolveAbsolutePath(path);
  }

  return path;
}
