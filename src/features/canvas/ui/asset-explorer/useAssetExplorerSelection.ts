import { useCallback, useMemo, useState } from 'react';

import type { ProjectDirectoryEntry } from '@/features/project/types';
import { getSiblingEntries } from '@/features/project/asset/assetExplorerPathUtils';
import { normalizeAssetPath } from '@/features/project/asset/assetManifest';

function pathsToSet(paths: Iterable<string>): Set<string> {
  return new Set(Array.from(paths).map((path) => normalizeAssetPath(path)));
}

export function useAssetExplorerSelection(tree: ProjectDirectoryEntry | null) {
  const [selectedPaths, setSelectedPathsState] = useState<Set<string>>(() => new Set());
  const [anchorPath, setAnchorPath] = useState<string | null>(null);

  const setSelectedPaths = useCallback((paths: Iterable<string>) => {
    const next = pathsToSet(paths);
    setSelectedPathsState(next);
    if (next.size === 0) {
      setAnchorPath(null);
    }
  }, []);

  const selectSingle = useCallback((path: string) => {
    const normalized = normalizeAssetPath(path);
    setSelectedPathsState(new Set([normalized]));
    setAnchorPath(normalized);
  }, []);

  const togglePath = useCallback((path: string) => {
    const normalized = normalizeAssetPath(path);
    setSelectedPathsState((current) => {
      const next = new Set(current);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
    setAnchorPath(normalized);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPathsState(new Set());
    setAnchorPath(null);
  }, []);

  const selectSiblingAll = useCallback(() => {
    if (!tree) {
      return false;
    }

    const referencePath = anchorPath ?? (selectedPaths.size === 1 ? Array.from(selectedPaths)[0] : null);
    if (!referencePath) {
      return false;
    }

    const rootPath = normalizeAssetPath(tree.path);
    if (normalizeAssetPath(referencePath) === rootPath) {
      const siblings = getSiblingEntries(tree, referencePath);
      if (siblings.length === 0) {
        return false;
      }
      setSelectedPaths(siblings.map((entry) => entry.path));
      setAnchorPath(referencePath);
      return true;
    }

    const siblings = getSiblingEntries(tree, referencePath);
    if (siblings.length === 0) {
      return false;
    }

    setSelectedPaths(siblings.map((entry) => entry.path));
    setAnchorPath(referencePath);
    return true;
  }, [anchorPath, selectedPaths, setSelectedPaths, tree]);

  const removePaths = useCallback((paths: Iterable<string>) => {
    const toRemove = pathsToSet(paths);
    setSelectedPathsState((current) => {
      const next = new Set(current);
      for (const path of toRemove) {
        next.delete(path);
      }
      return next;
    });
    setAnchorPath((current) => (current && toRemove.has(current) ? null : current));
  }, []);

  const replacePaths = useCallback((pathMap: Map<string, string>) => {
    setSelectedPathsState((current) => {
      const next = new Set<string>();
      for (const path of current) {
        next.add(pathMap.get(path) ?? path);
      }
      return next;
    });
    setAnchorPath((current) => (current ? pathMap.get(current) ?? current : null));
  }, []);

  const selectedPathList = useMemo(() => Array.from(selectedPaths), [selectedPaths]);

  return {
    selectedPaths,
    selectedPathList,
    anchorPath,
    selectSingle,
    togglePath,
    clearSelection,
    selectSiblingAll,
    setSelectedPaths,
    removePaths,
    replacePaths,
  };
}
