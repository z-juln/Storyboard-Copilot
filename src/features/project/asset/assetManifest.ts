import { v4 as uuidv4 } from 'uuid';

import { isProjectRelativeAssetPath } from '@/features/project/projectPaths';

import type { AssetManifest, FileAssetRecord } from './types';

export function createEmptyAssetManifest(): AssetManifest {
  return {};
}

export function normalizeAssetPath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

export function findFileAssetIdByPath(manifest: AssetManifest, path: string): string | null {
  const normalized = normalizeAssetPath(path);
  for (const [fileAssetId, record] of Object.entries(manifest)) {
    if (normalizeAssetPath(record.path) === normalized) {
      return fileAssetId;
    }
  }
  return null;
}

export function registerFileAssetPath(
  manifest: AssetManifest,
  path: string,
  options?: { updatedAt?: number; contentHash?: string }
): { manifest: AssetManifest; fileAssetId: string; created: boolean } {
  const normalized = normalizeAssetPath(path);
  if (!isProjectRelativeAssetPath(normalized)) {
    throw new Error(`Invalid project asset path: ${path}`);
  }

  const existingId = findFileAssetIdByPath(manifest, normalized);
  if (existingId) {
    const existing = manifest[existingId];
    const nextRecord: FileAssetRecord = {
      ...existing,
      path: normalized,
      updatedAt: options?.updatedAt ?? existing.updatedAt,
      contentHash: options?.contentHash ?? existing.contentHash,
    };
    if (
      nextRecord.updatedAt === existing.updatedAt
      && nextRecord.contentHash === existing.contentHash
      && nextRecord.path === existing.path
    ) {
      return { manifest, fileAssetId: existingId, created: false };
    }
    return {
      manifest: { ...manifest, [existingId]: nextRecord },
      fileAssetId: existingId,
      created: false,
    };
  }

  const fileAssetId = uuidv4();
  const record: FileAssetRecord = {
    path: normalized,
    updatedAt: options?.updatedAt ?? Date.now(),
    ...(options?.contentHash ? { contentHash: options.contentHash } : {}),
  };
  return {
    manifest: { ...manifest, [fileAssetId]: record },
    fileAssetId,
    created: true,
  };
}

export function updateFileAssetPath(
  manifest: AssetManifest,
  fileAssetId: string,
  nextPath: string
): AssetManifest {
  const record = manifest[fileAssetId];
  if (!record) {
    throw new Error(`Unknown fileAssetId: ${fileAssetId}`);
  }
  const normalized = normalizeAssetPath(nextPath);
  if (!isProjectRelativeAssetPath(normalized)) {
    throw new Error(`Invalid project asset path: ${nextPath}`);
  }
  return {
    ...manifest,
    [fileAssetId]: {
      ...record,
      path: normalized,
      updatedAt: Date.now(),
    },
  };
}

export function removeFileAsset(manifest: AssetManifest, fileAssetId: string): AssetManifest {
  if (!manifest[fileAssetId]) {
    return manifest;
  }
  const next = { ...manifest };
  delete next[fileAssetId];
  return next;
}

export function resolveManifestPath(
  manifest: AssetManifest,
  fileAssetId: string | null | undefined
): string | null {
  if (!fileAssetId) {
    return null;
  }
  return manifest[fileAssetId]?.path ?? null;
}

export function remapManifestPathPrefix(
  manifest: AssetManifest,
  fromPrefix: string,
  toPrefix: string
): AssetManifest {
  const from = normalizeAssetPath(fromPrefix).replace(/\/+$/, '');
  const to = normalizeAssetPath(toPrefix).replace(/\/+$/, '');
  if (from === to) {
    return manifest;
  }

  let next = manifest;
  for (const [fileAssetId, record] of Object.entries(manifest)) {
    const path = normalizeAssetPath(record.path);
    if (path === from || path.startsWith(`${from}/`)) {
      const suffix = path.slice(from.length);
      next = updateFileAssetPath(next, fileAssetId, `${to}${suffix}`);
    }
  }
  return next;
}

export function removeManifestPaths(manifest: AssetManifest, paths: string[]): AssetManifest {
  const normalizedPaths = new Set(paths.map((path) => normalizeAssetPath(path)));
  let next = manifest;
  for (const [fileAssetId, record] of Object.entries(manifest)) {
    if (normalizedPaths.has(normalizeAssetPath(record.path))) {
      next = removeFileAsset(next, fileAssetId);
    }
  }
  return next;
}
