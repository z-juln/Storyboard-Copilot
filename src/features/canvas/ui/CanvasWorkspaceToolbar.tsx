import { memo } from 'react';
import { FolderTree } from 'lucide-react';

import { UiChipButton, UiPanel } from '@/components/ui';

interface CanvasWorkspaceToolbarProps {
  showAssetManager: boolean;
  onToggleAssetManager: () => void;
}

export const CanvasWorkspaceToolbar = memo(({
  showAssetManager,
  onToggleAssetManager,
}: CanvasWorkspaceToolbarProps) => {
  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20">
      <UiPanel className="pointer-events-auto flex items-center gap-1 rounded-xl p-1 shadow-lg">
        <UiChipButton
          active={showAssetManager}
          className="h-8 px-3 text-xs"
          onClick={onToggleAssetManager}
          title={showAssetManager ? '隐藏资产管理' : '显示资产管理'}
        >
          <FolderTree className="h-3.5 w-3.5" />
          资产管理
        </UiChipButton>
      </UiPanel>
    </div>
  );
});

CanvasWorkspaceToolbar.displayName = 'CanvasWorkspaceToolbar';
