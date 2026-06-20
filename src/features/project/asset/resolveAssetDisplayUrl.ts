import {
  buildProjectAssetUrl,
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
}): string {
  const { projectId, fileAssetId, imageUrl, assetManifest, resolveAbsolutePath } = input;

  if (typeof imageUrl === 'string' && isRemoteImageUrl(imageUrl)) {
    return imageUrl;
  }

  const manifestPath = resolveManifestPath(assetManifest ?? {}, fileAssetId);
  const path = manifestPath ?? (typeof imageUrl === 'string' ? imageUrl.trim() : '');
  if (!path) {
    return '';
  }

  if (projectId && isProjectRelativeAssetPath(path)) {
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
