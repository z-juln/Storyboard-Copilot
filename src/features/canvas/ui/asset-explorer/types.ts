import type { ProjectDirectoryEntry } from '@/features/project/types';

import type { AssetPreviewState } from '../AssetPreviewDialog';

export interface AssetExplorerPanelProps {
  projectId: string;
  readOnly?: boolean;
}

export interface DeleteConfirmState {
  entry: ProjectDirectoryEntry;
  refCount: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  entry: ProjectDirectoryEntry;
  isAssetsRoot?: boolean;
}

export type { AssetPreviewState };
