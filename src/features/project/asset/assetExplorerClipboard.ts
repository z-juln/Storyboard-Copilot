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

export async function writeAssetPathsToSystemClipboard(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  try {
    await navigator.clipboard.writeText(paths.join('\n'));
  } catch (error) {
    console.warn('[asset] failed to write system clipboard', error);
  }
}
