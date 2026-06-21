import { memo, useMemo } from 'react';
import { Link2 } from 'lucide-react';

import { resolveNodeAssetBindingLabel } from '@/features/canvas/application/nodeAssetBinding';
import type { ProjectAssetBinding } from '@/features/project/asset';
import { useProjectStore } from '@/stores/projectStore';

interface NodeAssetBindingMetaProps {
  binding: ProjectAssetBinding;
  sourceFileName?: string | null;
  className?: string;
}

export const NodeAssetBindingMeta = memo(({
  binding,
  sourceFileName,
  className = '',
}: NodeAssetBindingMetaProps) => {
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const label = useMemo(
    () => resolveNodeAssetBindingLabel(binding, { sourceFileName, assetManifest }),
    [assetManifest, binding.fileAssetId, binding.imageUrl, sourceFileName]
  );

  if (!label) {
    return null;
  }

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs leading-none text-accent/90 ${className}`.trim()}>
      <Link2 className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
});

NodeAssetBindingMeta.displayName = 'NodeAssetBindingMeta';
