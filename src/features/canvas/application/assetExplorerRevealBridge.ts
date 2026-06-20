import { normalizeAssetPath } from '@/features/project/asset/assetManifest';

import { canvasEventBus } from './canvasServices';

/** Explorer 未挂载时暂存 reveal 请求，避免事件丢失。 */
let pendingRevealPath: string | null = null;
const handlers = new Set<(path: string) => void>();

canvasEventBus.subscribe('asset-explorer/reveal-asset', ({ path }) => {
  const normalized = normalizeAssetPath(path);
  if (handlers.size === 0) {
    pendingRevealPath = normalized;
    return;
  }
  handlers.forEach((handler) => {
    handler(normalized);
  });
});

export function subscribeAssetExplorerReveal(handler: (path: string) => void): () => void {
  handlers.add(handler);
  if (pendingRevealPath) {
    const path = pendingRevealPath;
    pendingRevealPath = null;
    handler(path);
  }
  return () => {
    handlers.delete(handler);
  };
}
