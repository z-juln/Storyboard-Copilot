import { normalizeAssetPath } from '@/features/project/asset';
import { useProjectStore } from '@/stores/projectStore';

import { revealProjectAsset } from './assetExplorerRevealBridge';

export function notifyProjectAssetsImported(
  paths: string | string[],
  options?: { reveal?: boolean }
): void {
  const normalizedPaths = (Array.isArray(paths) ? paths : [paths])
    .map((path) => normalizeAssetPath(path))
    .filter((path) => path.length > 0);
  if (normalizedPaths.length === 0) {
    return;
  }

  useProjectStore.getState().markAssetPathsAvailable(normalizedPaths);

  if (options?.reveal ?? true) {
    revealProjectAsset(normalizedPaths[0]!);
  }
}
