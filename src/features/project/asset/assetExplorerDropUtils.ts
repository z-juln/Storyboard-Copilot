import type { ProjectDirectoryEntry } from '@/features/project/types';

import { getAssetParentPath } from './assetExplorerPathUtils';

type FileWithPath = File & { path?: string };

export interface DragTransferEvent {
  dataTransfer: DataTransfer | null;
}

function normalizeDroppedFilePath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith('file://')) {
    try {
      const url = new URL(trimmed);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('//') && /^\/[A-Za-z]:\//.test(pathname.slice(1))) {
        pathname = pathname.slice(1);
      }
      return pathname || null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return null;
}

function parseUriList(raw: string): string[] {
  const paths: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const normalized = normalizeDroppedFilePath(trimmed);
    if (normalized) {
      paths.push(normalized);
    }
  }
  return paths;
}

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

export function resolveDropImportTargetDirectory(entry: ProjectDirectoryEntry): string {
  return entry.kind === 'directory' ? entry.path : getAssetParentPath(entry.path);
}

export function resolveExternalDropPaths(event: DragTransferEvent): string[] {
  const paths: string[] = [];

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    for (const file of Array.from(files)) {
      const rawPath = (file as FileWithPath).path;
      if (typeof rawPath !== 'string') {
        continue;
      }
      const normalized = normalizeDroppedFilePath(rawPath);
      if (normalized) {
        paths.push(normalized);
      }
    }
  }

  const uriList = event.dataTransfer?.getData('text/uri-list') ?? '';
  if (uriList.trim()) {
    paths.push(...parseUriList(uriList));
  }

  const plain = event.dataTransfer?.getData('text/plain')?.trim() ?? '';
  if (plain) {
    for (const line of plain.split(/\r?\n/)) {
      const normalized = normalizeDroppedFilePath(line);
      if (normalized) {
        paths.push(normalized);
      }
    }
  }

  return dedupePaths(paths);
}

export function resolveExternalDropFiles(event: DragTransferEvent): File[] {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return [];
  }

  const dropped: File[] = [];
  for (const file of Array.from(files)) {
    const rawPath = (file as FileWithPath).path;
    if (typeof rawPath === 'string' && rawPath.trim()) {
      continue;
    }
    if (!file.name.trim()) {
      continue;
    }
    dropped.push(file);
  }
  return dropped;
}

export function hasExternalFileDrop(event: DragTransferEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  return (
    types.includes('Files')
    || types.includes('text/uri-list')
    || types.includes('application/x-moz-file')
  );
}

export function resolveInternalAssetDropPaths(
  event: DragTransferEvent,
  dragSourcePaths: string[]
): string[] {
  if (hasExternalFileDrop(event)) {
    return [];
  }

  if (dragSourcePaths.length > 0) {
    return dragSourcePaths;
  }

  const plain = event.dataTransfer?.getData('text/plain')?.trim() ?? '';
  if (plain.startsWith('assets/') || plain === 'assets') {
    return [plain];
  }

  return [];
}
