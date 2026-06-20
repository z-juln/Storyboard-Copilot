import { rustApiClient } from '@/infrastructure/rustApiClient';

export type AssetClipboardMode = 'copy' | 'cut';

export interface AssetClipboardPasteItem {
  absolutePath: string;
  projectRelativePath: string | null;
  kind: 'file' | 'directory';
}

export interface AssetClipboardPastePayload {
  mode: AssetClipboardMode;
  items: AssetClipboardPasteItem[];
}

function normalizeClipboardPayload(payload: {
  mode: string;
  items: Array<{
    absolutePath: string;
    projectRelativePath: string | null;
    kind: string;
  }>;
}): AssetClipboardPastePayload {
  return {
    mode: payload.mode === 'cut' ? 'cut' : 'copy',
    items: payload.items.map((item) => ({
      absolutePath: item.absolutePath,
      projectRelativePath: item.projectRelativePath,
      kind: item.kind === 'directory' ? 'directory' : 'file',
    })),
  };
}

export async function writeProjectAssetsToSystemClipboard(
  projectId: string,
  relativePaths: string[],
  cut: boolean
): Promise<void> {
  if (relativePaths.length === 0) {
    return;
  }

  await rustApiClient.writeProjectAssetsClipboard(projectId, relativePaths, cut);
}

export async function readProjectAssetsFromSystemClipboard(
  projectId: string
): Promise<AssetClipboardPastePayload> {
  const payload = await rustApiClient.readProjectAssetsClipboard(projectId);
  return normalizeClipboardPayload(payload);
}

export async function clearSystemClipboardCutMarker(): Promise<void> {
  await rustApiClient.clearProjectAssetsClipboardCut();
}

export async function hasSystemClipboardAssetItems(projectId: string): Promise<boolean> {
  try {
    const payload = await readProjectAssetsFromSystemClipboard(projectId);
    return payload.items.length > 0;
  } catch {
    return false;
  }
}
