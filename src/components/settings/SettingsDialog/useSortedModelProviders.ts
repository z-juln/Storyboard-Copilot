import { useMemo } from 'react';

import { listModelProviders } from '@/features/canvas/models';

const PROVIDER_ORDER = ['kie', 'ppio', 'fal', 'grsai'];

export function useSortedModelProviders() {
  return useMemo(() => {
    const providerIndex = new Map(PROVIDER_ORDER.map((id, index) => [id, index]));
    return listModelProviders().slice().sort((left, right) => {
      const leftIndex = providerIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = providerIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }, []);
}
