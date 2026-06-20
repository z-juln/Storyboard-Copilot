import type { CanvasNode } from '@/stores/canvasStore';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';
import { rustApiClient } from '@/infrastructure/rustApiClient';

import type { AssetExplorerClipboardState } from './assetExplorerClipboard';
import {
  getAssetBaseName,
  isDescendantAssetPath,
  joinAssetPath,
  collectFilePathsFromEntry,
} from './assetExplorerPathUtils';
import {
  createEmptyAssetManifest,
  findFileAssetIdByPath,
  normalizeAssetPath,
  registerFileAssetPath,
  remapManifestPathPrefix,
  removeFileAsset,
  removeManifestPaths,
} from './assetManifest';
import type { AssetManifest } from './types';
import { countRefsForFileAssetId } from './assetRefIndex';

async function fetchAssetBlob(projectId: string, path: string): Promise<Blob> {
  const response = await fetch(buildProjectAssetUrl(projectId, path));
  if (!response.ok) {
    throw new Error(`读取资产失败: ${path}`);
  }
  return await response.blob();
}

async function deleteEntryRecursive(projectId: string, entry: ProjectDirectoryEntry): Promise<void> {
  if (entry.kind === 'file') {
    await rustApiClient.deleteProjectAsset(projectId, entry.path);
    return;
  }

  for (const child of entry.children ?? []) {
    await deleteEntryRecursive(projectId, child);
  }
  await rustApiClient.deleteProjectAsset(projectId, entry.path);
}

function resolveUniquePath(existingPaths: Set<string>, desiredPath: string): string {
  const normalizedDesired = normalizeAssetPath(desiredPath);
  if (!existingPaths.has(normalizedDesired)) {
    return normalizedDesired;
  }

  const baseName = getAssetBaseName(normalizedDesired);
  const parent = normalizedDesired.slice(0, normalizedDesired.length - baseName.length).replace(/\/$/, '');
  const dot = baseName.lastIndexOf('.');
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName;
  const ext = dot > 0 ? baseName.slice(dot) : '';

  for (let index = 1; index < 1000; index += 1) {
    const candidate = joinAssetPath(parent, `${stem} (${index})${ext}`);
    if (!existingPaths.has(candidate)) {
      return candidate;
    }
  }

  throw new Error(`无法生成唯一路径: ${desiredPath}`);
}

function listExistingManifestPaths(manifest: AssetManifest): Set<string> {
  return new Set(Object.values(manifest).map((record) => normalizeAssetPath(record.path)));
}

export function countAssetPathRefs(
  manifest: AssetManifest,
  nodes: CanvasNode[],
  paths: string[]
): number {
  let total = 0;
  for (const path of paths) {
    const fileAssetId = findFileAssetIdByPath(manifest, path);
    if (fileAssetId) {
      total += countRefsForFileAssetId(manifest, nodes, fileAssetId);
    }
  }
  return total;
}

export async function moveProjectAssetEntry(input: {
  projectId: string;
  fromPath: string;
  toPath: string;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const from = normalizeAssetPath(input.fromPath);
  const to = normalizeAssetPath(input.toPath);
  await rustApiClient.moveProjectAsset(input.projectId, from, to);
  return remapManifestPathPrefix(input.manifest, from, to);
}

export async function renameProjectAssetEntry(input: {
  projectId: string;
  entry: ProjectDirectoryEntry;
  nextName: string;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const parentPath = normalizeAssetPath(input.entry.path);
  const parent = parentPath.split('/').slice(0, -1).join('/') || 'assets';
  const nextPath = joinAssetPath(parent, input.nextName);
  return moveProjectAssetEntry({
    projectId: input.projectId,
    fromPath: input.entry.path,
    toPath: nextPath,
    manifest: input.manifest,
  });
}

export async function deleteProjectAssetEntry(input: {
  projectId: string;
  entry: ProjectDirectoryEntry;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const filePaths = collectFilePathsFromEntry(input.entry);
  await deleteEntryRecursive(input.projectId, input.entry);
  return removeManifestPaths(input.manifest, filePaths);
}

export async function copyProjectAssetEntry(input: {
  projectId: string;
  entry: ProjectDirectoryEntry;
  targetDirPath: string;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const targetDir = normalizeAssetPath(input.targetDirPath).replace(/\/+$/, '') || 'assets';
  const existingPaths = listExistingManifestPaths(input.manifest);
  let manifest = input.manifest;

  const copyFile = async (sourcePath: string) => {
    const baseName = getAssetBaseName(sourcePath);
    const desiredPath = targetDir === 'assets' ? `assets/${baseName}` : `${targetDir}/${baseName}`;
    const nextPath = resolveUniquePath(existingPaths, desiredPath);
    existingPaths.add(nextPath);

    const blob = await fetchAssetBlob(input.projectId, sourcePath);
    await rustApiClient.putProjectAssetAtPath(input.projectId, nextPath, blob);
    const registered = registerFileAssetPath(manifest, nextPath);
    manifest = registered.manifest;
  };

  const copyEntry = async (entry: ProjectDirectoryEntry, parentDir: string) => {
    if (entry.kind === 'file') {
      const baseName = getAssetBaseName(entry.path);
      const desiredPath = parentDir === 'assets' ? `assets/${baseName}` : `${parentDir}/${baseName}`;
      const nextPath = resolveUniquePath(existingPaths, desiredPath);
      existingPaths.add(nextPath);
      const blob = await fetchAssetBlob(input.projectId, entry.path);
      await rustApiClient.putProjectAssetAtPath(input.projectId, nextPath, blob);
      const registered = registerFileAssetPath(manifest, nextPath);
      manifest = registered.manifest;
      return;
    }

    const dirName = getAssetBaseName(entry.path);
    const desiredDir = parentDir === 'assets' ? `assets/${dirName}` : `${parentDir}/${dirName}`;
    const nextDir = resolveUniquePath(existingPaths, desiredDir);
    existingPaths.add(nextDir);
    await rustApiClient.createProjectAssetDirectory(input.projectId, nextDir);

    for (const child of entry.children ?? []) {
      await copyEntry(child, nextDir);
    }
  };

  if (input.entry.kind === 'file') {
    await copyFile(input.entry.path);
    return manifest;
  }

  await copyEntry(input.entry, targetDir);
  return manifest;
}

export async function pasteAssetExplorerClipboard(input: {
  projectId: string;
  targetDirPath: string;
  clipboard: AssetExplorerClipboardState;
  tree: ProjectDirectoryEntry;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const targetDir = normalizeAssetPath(input.targetDirPath).replace(/\/+$/, '') || 'assets';
  let manifest = input.manifest;

  const findEntry = (path: string): ProjectDirectoryEntry | null => {
    const normalized = normalizeAssetPath(path);
    const walk = (entry: ProjectDirectoryEntry): ProjectDirectoryEntry | null => {
      if (normalizeAssetPath(entry.path) === normalized) {
        return entry;
      }
      for (const child of entry.children ?? []) {
        const found = walk(child);
        if (found) {
          return found;
        }
      }
      return null;
    };
    if (normalizeAssetPath(input.tree.path) === normalized) {
      return input.tree;
    }
    for (const child of input.tree.children ?? []) {
      const found = walk(child);
      if (found) {
        return found;
      }
    }
    return null;
  };

  for (const item of input.clipboard.items) {
    if (isDescendantAssetPath(item.path, targetDir) && item.kind === 'directory') {
      continue;
    }

    const entry = findEntry(item.path);
    if (!entry) {
      continue;
    }

    if (input.clipboard.mode === 'cut') {
      const baseName = getAssetBaseName(item.path);
      const nextPath = joinAssetPath(targetDir, baseName);
      manifest = await moveProjectAssetEntry({
        projectId: input.projectId,
        fromPath: item.path,
        toPath: nextPath,
        manifest,
      });
      continue;
    }

    manifest = await copyProjectAssetEntry({
      projectId: input.projectId,
      entry,
      targetDirPath: targetDir,
      manifest,
    });
  }

  return manifest;
}

export function removeMissingManifestEntries(manifest: AssetManifest, path: string): AssetManifest {
  const fileAssetId = findFileAssetIdByPath(manifest, path);
  if (!fileAssetId) {
    return manifest;
  }
  return removeFileAsset(manifest, fileAssetId);
}

export function createDefaultAssetManifest(): AssetManifest {
  return createEmptyAssetManifest();
}

export function resolveNewSiblingName(
  kind: 'file' | 'directory',
  siblingNames: Iterable<string>
): string {
  const siblings = new Set(Array.from(siblingNames));
  if (kind === 'directory') {
    for (let index = 0; index < 1000; index += 1) {
      const name = index === 0 ? '新建文件夹' : `新建文件夹 (${index})`;
      if (!siblings.has(name)) {
        return name;
      }
    }
    throw new Error('无法生成唯一文件夹名称');
  }

  for (let index = 0; index < 1000; index += 1) {
    const name = index === 0 ? '新建文件.txt' : `新建文件 (${index}).txt`;
    if (!siblings.has(name)) {
      return name;
    }
  }
  throw new Error('无法生成唯一文件名称');
}

export async function createProjectAssetFolder(input: {
  projectId: string;
  parentDirPath: string;
  name: string;
}): Promise<string> {
  const path = joinAssetPath(input.parentDirPath, input.name);
  return rustApiClient.createProjectAssetDirectory(input.projectId, path);
}

export async function createProjectAssetFile(input: {
  projectId: string;
  parentDirPath: string;
  name: string;
  manifest: AssetManifest;
}): Promise<{ path: string; manifest: AssetManifest }> {
  const path = joinAssetPath(input.parentDirPath, input.name);
  await rustApiClient.putProjectAssetAtPath(input.projectId, path, new Blob([]));
  const registered = registerFileAssetPath(input.manifest, path);
  return {
    path,
    manifest: registered.manifest,
  };
}
