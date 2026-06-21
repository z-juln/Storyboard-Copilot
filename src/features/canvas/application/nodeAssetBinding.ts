import {
  getAssetBaseName,
  normalizeAssetPath,
  resolveManifestPath,
  type ProjectAssetBinding,
} from '@/features/project/asset';
import type { AssetManifest } from '@/features/project/asset/types';
import { isProjectRelativeAssetPath } from '@/features/project/projectPaths';

export function isNodeProjectAssetBound(binding: ProjectAssetBinding): boolean {
  const fileAssetId = typeof binding.fileAssetId === 'string' ? binding.fileAssetId.trim() : '';
  if (fileAssetId.length > 0) {
    return true;
  }

  const imageUrl = typeof binding.imageUrl === 'string' ? binding.imageUrl.trim() : '';
  return imageUrl.length > 0 && isProjectRelativeAssetPath(imageUrl);
}

export function resolveNodeAssetBindingLabel(
  binding: ProjectAssetBinding,
  options?: {
    sourceFileName?: string | null;
    assetManifest?: AssetManifest | null;
  }
): string | null {
  if (!isNodeProjectAssetBound(binding)) {
    return null;
  }

  const sourceFileName = typeof options?.sourceFileName === 'string'
    ? options.sourceFileName.trim()
    : '';
  if (sourceFileName) {
    return `已绑定 · ${sourceFileName}`;
  }

  const manifest = options?.assetManifest ?? {};
  const manifestPath = resolveManifestPath(manifest, binding.fileAssetId)
    ?? (
      typeof binding.imageUrl === 'string' && isProjectRelativeAssetPath(binding.imageUrl)
        ? normalizeAssetPath(binding.imageUrl)
        : null
    );

  if (manifestPath) {
    return `已绑定 · ${getAssetBaseName(manifestPath)}`;
  }

  return '已绑定文件';
}
