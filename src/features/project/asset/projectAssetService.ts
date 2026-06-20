import type { CanvasNode } from '@/stores/canvasStore';
import type { ProjectDirectoryEntry } from '@/features/project/types';
import { rustApiClient } from '@/infrastructure/rustApiClient';

import type { AssetClipboardPasteItem, AssetClipboardMode } from './assetExplorerClipboard';
import {
  collectFilePathsFromEntry,
  findEntryInTree,
  getAssetBaseName,
  isDescendantAssetPath,
  joinAssetPath,
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

function registerCopiedSubtreeInManifest(
  manifest: AssetManifest,
  entry: ProjectDirectoryEntry,
  destPath: string
): AssetManifest {
  if (entry.kind === 'file') {
    return registerFileAssetPath(manifest, destPath).manifest;
  }

  let nextManifest = manifest;
  for (const child of entry.children ?? []) {
    const childDest = joinAssetPath(destPath, getAssetBaseName(child.path));
    nextManifest = registerCopiedSubtreeInManifest(nextManifest, child, childDest);
  }
  return nextManifest;
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

export async function deleteProjectAssetEntries(input: {
  projectId: string;
  entries: ProjectDirectoryEntry[];
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  let manifest = input.manifest;
  for (const entry of input.entries) {
    manifest = await deleteProjectAssetEntry({
      projectId: input.projectId,
      entry,
      manifest,
    });
  }
  return manifest;
}

export async function moveProjectAssetEntries(input: {
  projectId: string;
  moves: Array<{ fromPath: string; toPath: string }>;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  let manifest = input.manifest;
  for (const move of input.moves) {
    manifest = await moveProjectAssetEntry({
      projectId: input.projectId,
      fromPath: move.fromPath,
      toPath: move.toPath,
      manifest,
    });
  }
  return manifest;
}

export async function copyProjectAssetEntry(input: {
  projectId: string;
  entry: ProjectDirectoryEntry;
  targetDirPath: string;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const targetDir = normalizeAssetPath(input.targetDirPath).replace(/\/+$/, '') || 'assets';
  const existingPaths = listExistingManifestPaths(input.manifest);
  const baseName = getAssetBaseName(input.entry.path);
  const desiredPath = targetDir === 'assets' ? `assets/${baseName}` : `${targetDir}/${baseName}`;
  const nextPath = resolveUniquePath(existingPaths, desiredPath);

  await rustApiClient.copyProjectAsset(input.projectId, input.entry.path, nextPath);

  if (input.entry.kind === 'file') {
    return registerFileAssetPath(input.manifest, nextPath).manifest;
  }

  return registerCopiedSubtreeInManifest(input.manifest, input.entry, nextPath);
}

export async function pasteSystemClipboardToDirectory(input: {
  projectId: string;
  targetDirPath: string;
  mode: AssetClipboardMode;
  items: AssetClipboardPasteItem[];
  tree: ProjectDirectoryEntry;
  manifest: AssetManifest;
}): Promise<AssetManifest> {
  const targetDir = normalizeAssetPath(input.targetDirPath).replace(/\/+$/, '') || 'assets';
  let manifest = input.manifest;

  const projectItems = input.items.filter((item) => item.projectRelativePath);
  const externalItems = input.items.filter((item) => !item.projectRelativePath);

  for (const item of projectItems) {
    const sourcePath = item.projectRelativePath!;
    if (isDescendantAssetPath(sourcePath, targetDir) && item.kind === 'directory') {
      continue;
    }

    const entry = findEntryInTree(input.tree, sourcePath);
    if (!entry) {
      continue;
    }

    if (input.mode === 'cut') {
      const baseName = getAssetBaseName(sourcePath);
      const nextPath = joinAssetPath(targetDir, baseName);
      manifest = await moveProjectAssetEntry({
        projectId: input.projectId,
        fromPath: sourcePath,
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

  if (externalItems.length > 0) {
    const result = await rustApiClient.importProjectAssets(
      input.projectId,
      targetDir,
      externalItems.map((item) => item.absolutePath)
    );

    for (const imported of result.imports) {
      for (const filePath of imported.filePaths) {
        manifest = registerFileAssetPath(manifest, filePath).manifest;
      }
    }
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
