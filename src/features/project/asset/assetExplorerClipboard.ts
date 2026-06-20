export type AssetClipboardMode = 'copy' | 'cut';

export interface AssetClipboardItem {
  path: string;
  kind: 'file' | 'directory';
}

export interface AssetExplorerClipboardState {
  mode: AssetClipboardMode;
  items: AssetClipboardItem[];
}

let clipboardState: AssetExplorerClipboardState | null = null;

export function getAssetExplorerClipboard(): AssetExplorerClipboardState | null {
  return clipboardState;
}

export function setAssetExplorerClipboard(state: AssetExplorerClipboardState | null): void {
  clipboardState = state;
}

export function hasAssetExplorerClipboard(): boolean {
  return Boolean(clipboardState?.items.length);
}
