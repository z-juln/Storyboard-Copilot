import { useMemo } from 'react';

import { useProjectStore } from '@/stores/projectStore';

import { createEmptyAssetManifest, isProjectAssetAvailable } from './assetManifest';

export interface ProjectAssetBinding {
  imageUrl?: string | null;
  fileAssetId?: string | null;
}

function hasProjectAssetBinding(binding: ProjectAssetBinding): boolean {
  const fileAssetId = typeof binding.fileAssetId === 'string' ? binding.fileAssetId.trim() : '';
  const imageUrl = typeof binding.imageUrl === 'string' ? binding.imageUrl.trim() : '';
  return fileAssetId.length > 0 || imageUrl.length > 0;
}

/** 订阅 manifest / 磁盘索引 / 资源 epoch，判断项目资产是否仍可用。 */
export function useProjectAssetAvailability(binding: ProjectAssetBinding): boolean {
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const availableAssetPaths = useProjectStore((state) => state.availableAssetPaths);

  return useMemo(() => {
    if (!hasProjectAssetBinding(binding)) {
      return true;
    }
    return isProjectAssetAvailable(
      assetManifest ?? createEmptyAssetManifest(),
      binding,
      availableAssetPaths
    );
  }, [assetManifest, availableAssetPaths, binding.fileAssetId, binding.imageUrl]);
}

export function useIsProjectAssetUnavailable(binding: ProjectAssetBinding): boolean {
  const isAvailable = useProjectAssetAvailability(binding);
  return useMemo(
    () => hasProjectAssetBinding(binding) && !isAvailable,
    [binding.fileAssetId, binding.imageUrl, isAvailable]
  );
}
