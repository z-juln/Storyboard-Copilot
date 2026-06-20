import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { PROJECT_ASSET_UNAVAILABLE_MESSAGE } from '@/features/project/asset';

interface NodeAssetUnavailableNoticeProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export const NodeAssetUnavailableNotice = memo(({
  message = PROJECT_ASSET_UNAVAILABLE_MESSAGE,
  className = '',
  compact = false,
}: NodeAssetUnavailableNoticeProps) => (
  <div
    className={`flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-text-muted ${className}`}
  >
    <AlertTriangle className={compact ? 'h-4 w-4 shrink-0 opacity-70' : 'h-7 w-7 shrink-0 opacity-70'} />
    <span className={`text-center leading-5 ${compact ? 'text-[10px]' : 'text-[12px]'}`}>{message}</span>
  </div>
));

NodeAssetUnavailableNotice.displayName = 'NodeAssetUnavailableNotice';
