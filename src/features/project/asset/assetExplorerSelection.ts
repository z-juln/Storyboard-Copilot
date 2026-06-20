import type { ProjectDirectoryEntry } from '@/features/project/types';

import type { AssetClipboardItem } from './assetExplorerClipboard';
import { findEntryInTree, isDescendantAssetPath } from './assetExplorerPathUtils';
import { normalizeAssetPath } from './assetManifest';

export function filterTopLevelSelectedPaths(paths: Iterable<string>): string[] {
  const normalizedPaths = Array.from(
    new Set(Array.from(paths).map((path) => normalizeAssetPath(path)))
  );

  return normalizedPaths.filter((path) =>
    !normalizedPaths.some(
      (otherPath) => otherPath !== path && isDescendantAssetPath(otherPath, path)
    )
  );
}

export function resolveEntriesForPaths(
  root: ProjectDirectoryEntry,
  paths: Iterable<string>
): ProjectDirectoryEntry[] {
  const entries: ProjectDirectoryEntry[] = [];
  for (const path of paths) {
    const entry = findEntryInTree(root, path);
    if (entry) {
      entries.push(entry);
    }
  }
  return entries;
}

export function entriesToClipboardItems(entries: ProjectDirectoryEntry[]): AssetClipboardItem[] {
  return entries.map((entry) => ({
    path: entry.path,
    kind: entry.kind === 'directory' ? 'directory' : 'file',
  }));
}

export function resolveTopLevelSelectedEntries(
  root: ProjectDirectoryEntry,
  paths: Iterable<string>
): ProjectDirectoryEntry[] {
  const topLevelPaths = filterTopLevelSelectedPaths(paths);
  return resolveEntriesForPaths(root, topLevelPaths);
}
