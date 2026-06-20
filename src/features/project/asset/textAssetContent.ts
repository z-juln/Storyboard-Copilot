import { rustApiClient } from '@/infrastructure/rustApiClient';

import { registerFileAssetPath, normalizeAssetPath } from './assetManifest';
import { fetchAssetTextContent } from './assetPreviewUtils';
import type { AssetManifest } from './types';

export async function loadProjectAssetTextContent(
  projectId: string,
  path: string
): Promise<string | null> {
  return fetchAssetTextContent(projectId, path);
}

export async function saveProjectAssetTextContent(input: {
  projectId: string;
  path: string;
  content: string;
  manifest: AssetManifest;
}): Promise<{ manifest: AssetManifest; updatedAt: number }> {
  const normalizedPath = normalizeAssetPath(input.path);
  const blob = new Blob([input.content], { type: 'text/plain;charset=utf-8' });
  await rustApiClient.putProjectAssetAtPath(input.projectId, normalizedPath, blob);

  const updatedAt = Date.now();
  const registered = registerFileAssetPath(input.manifest, normalizedPath, { updatedAt });
  return {
    manifest: registered.manifest,
    updatedAt,
  };
}
