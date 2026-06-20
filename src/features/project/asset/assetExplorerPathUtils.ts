import type { ProjectDirectoryEntry } from '@/features/project/types';

import { normalizeAssetPath } from './assetManifest';

export function getAssetBaseName(path: string): string {
  const normalized = normalizeAssetPath(path);
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? normalized;
}

export function getAssetParentPath(path: string): string {
  const normalized = normalizeAssetPath(path);
  const segments = normalized.split('/');
  if (segments.length <= 1) {
    return 'assets';
  }
  segments.pop();
  return segments.join('/');
}

export function joinAssetPath(parentPath: string, name: string): string {
  const parent = normalizeAssetPath(parentPath).replace(/\/+$/, '');
  const child = name.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!child) {
    throw new Error('Invalid asset name');
  }
  if (parent === 'assets') {
    return `assets/${child}`;
  }
  return `${parent}/${child}`;
}

export function isDescendantAssetPath(parentPath: string, childPath: string): boolean {
  const parent = normalizeAssetPath(parentPath).replace(/\/+$/, '');
  const child = normalizeAssetPath(childPath);
  return child === parent || child.startsWith(`${parent}/`);
}

export function collectFilePathsFromEntry(entry: ProjectDirectoryEntry): string[] {
  if (entry.kind === 'file') {
    return [normalizeAssetPath(entry.path)];
  }
  const paths: string[] = [];
  entry.children?.forEach((child) => {
    paths.push(...collectFilePathsFromEntry(child));
  });
  return paths;
}

export function findEntryByPath(
  entries: ProjectDirectoryEntry[],
  path: string
): ProjectDirectoryEntry | null {
  const normalized = normalizeAssetPath(path);
  for (const entry of entries) {
    if (normalizeAssetPath(entry.path) === normalized) {
      return entry;
    }
    if (entry.children?.length) {
      const nested = findEntryByPath(entry.children, normalized);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function filterTreeByQuery(
  entry: ProjectDirectoryEntry,
  scopePath: string,
  query: string
): ProjectDirectoryEntry | null {
  const normalizedScope = normalizeAssetPath(scopePath).replace(/\/+$/, '');
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entry;
  }

  if (entry.kind === 'file') {
    if (!isDescendantAssetPath(normalizedScope, entry.path)) {
      return null;
    }
    return entry.name.toLowerCase().includes(normalizedQuery) ? entry : null;
  }

  if (!isDescendantAssetPath(normalizedScope, entry.path) && entry.path !== normalizedScope) {
    return null;
  }

  const children = entry.children
    ?.map((child) => filterTreeByQuery(child, normalizedScope, normalizedQuery))
    .filter((child): child is ProjectDirectoryEntry => child !== null);

  if (entry.path === normalizedScope) {
    return {
      ...entry,
      children: children?.length ? children : undefined,
    };
  }

  if (children && children.length > 0) {
    return { ...entry, children };
  }

  return entry.name.toLowerCase().includes(normalizedQuery) ? { ...entry, children: undefined } : null;
}
