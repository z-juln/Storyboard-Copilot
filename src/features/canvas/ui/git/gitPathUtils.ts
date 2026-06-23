export interface SplitGitChangePath {
  fileName: string;
  parentPath: string;
}

export function splitGitChangePath(path: string): SplitGitChangePath {
  const normalized = path.replace(/\\/g, '/');
  const slashIndex = normalized.lastIndexOf('/');
  if (slashIndex === -1) {
    return { fileName: normalized, parentPath: '' };
  }
  return {
    fileName: normalized.slice(slashIndex + 1),
    parentPath: normalized.slice(0, slashIndex),
  };
}

export function truncateGitParentPath(parentPath: string, maxLength = 18): string {
  if (!parentPath) {
    return '';
  }
  if (parentPath.length <= maxLength) {
    return parentPath;
  }
  return `…${parentPath.slice(-(maxLength - 1))}`;
}

export function isGitChangeAssetPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return normalized === 'assets' || normalized.startsWith('assets/');
}

export function canOpenGitChangeInExplorer(path: string): boolean {
  return isGitChangeAssetPath(path) || path === 'project.json';
}
