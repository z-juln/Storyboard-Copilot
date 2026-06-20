import type { CanvasNode } from '@/stores/canvasStore';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import { rustApiClient } from '@/infrastructure/rustApiClient';

import {
  findFileAssetIdByPath,
  normalizeAssetPath,
  registerFileAssetPath,
} from './assetManifest';
import { applyFileAssetIdToNodes, scanNodeAssetPathFields, syncNodeAssetPathsFromManifest } from './assetRefIndex';
import type { AssetManifest } from './types';

function collectFilePathsFromDirectory(entry: ProjectDirectoryEntry, paths: string[]): void {
  if (entry.kind === 'file' && entry.path.startsWith('assets/')) {
    paths.push(normalizeAssetPath(entry.path));
    return;
  }
  entry.children?.forEach((child) => collectFilePathsFromDirectory(child, paths));
}

export async function listProjectAssetFilePaths(projectId: string): Promise<string[]> {
  const directory = await rustApiClient.listProjectDirectory(projectId);
  const paths: string[] = [];
  const assetsRoot = directory.children?.find((child) => child.path === 'assets');
  if (assetsRoot) {
    collectFilePathsFromDirectory(assetsRoot, paths);
  }
  return paths;
}

export interface ReconcileProjectAssetsResult {
  assetManifest: AssetManifest;
  nodes: CanvasNode[];
  dirty: boolean;
}

export async function reconcileProjectAssets(input: {
  projectId: string;
  nodes: CanvasNode[];
  assetManifest?: AssetManifest | null;
}): Promise<ReconcileProjectAssetsResult> {
  let manifest: AssetManifest = { ...(input.assetManifest ?? {}) };
  let dirty = false;

  const diskPaths = await listProjectAssetFilePaths(input.projectId).catch((error) => {
    console.warn('[asset] failed to list project asset files during reconcile', error);
    return [] as string[];
  });

  for (const path of diskPaths) {
    const before = findFileAssetIdByPath(manifest, path);
    const registered = registerFileAssetPath(manifest, path);
    manifest = registered.manifest;
    if (registered.created || !before) {
      dirty = true;
    }
  }

  const pathBindings: Array<{ nodeId: string; field: string; fileAssetId: string }> = [];
  for (const item of scanNodeAssetPathFields(input.nodes)) {
    if (item.fileAssetId && manifest[item.fileAssetId]) {
      continue;
    }
    if (item.path) {
      const registered = registerFileAssetPath(manifest, item.path);
      manifest = registered.manifest;
      if (registered.created) {
        dirty = true;
      }
      pathBindings.push({
        nodeId: item.nodeId,
        field: item.field,
        fileAssetId: registered.fileAssetId,
      });
      continue;
    }
    if (item.fileAssetId && !manifest[item.fileAssetId]) {
      console.warn('[asset] node references missing fileAssetId', item);
    }
  }

  const nodesWithFileAssetIds = applyFileAssetIdToNodes(input.nodes, pathBindings);
  const nextNodes = syncNodeAssetPathsFromManifest(nodesWithFileAssetIds, manifest);
  if (pathBindings.length > 0 || nextNodes !== nodesWithFileAssetIds) {
    dirty = true;
  }

  return {
    assetManifest: manifest,
    nodes: nextNodes,
    dirty,
  };
}

export function registerPreparedAssetPath(
  manifest: AssetManifest,
  imagePath: string,
  contentHash?: string
): {
  manifest: AssetManifest;
  fileAssetId: string;
} {
  const registered = registerFileAssetPath(manifest, imagePath, contentHash ? { contentHash } : undefined);
  return {
    manifest: registered.manifest,
    fileAssetId: registered.fileAssetId,
  };
}
