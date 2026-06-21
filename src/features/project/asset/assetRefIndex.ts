import type { CanvasNode } from '@/stores/canvasStore';
import { isProjectRelativeAssetPath } from '@/features/project/projectPaths';

import type { AssetManifest, AssetRef } from './types';
import { findFileAssetIdByPath, normalizeAssetPath, resolveManifestPath } from './assetManifest';

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** 判断节点（含分镜帧）是否引用指定 fileAssetId 或 assets 路径。 */
export function nodeReferencesProjectAsset(
  node: CanvasNode,
  fileAssetId: string,
  path: string
): boolean {
  const normalizedPath = normalizeAssetPath(path);
  const data = node.data as Record<string, unknown>;
  const nodeFileAssetId = readOptionalString(data.fileAssetId);
  const nodeImageUrl = readOptionalString(data.imageUrl);
  if (nodeFileAssetId === fileAssetId || nodeImageUrl === normalizedPath) {
    return true;
  }

  if (!Array.isArray(data.frames)) {
    return false;
  }

  return data.frames.some((frame) => {
    if (!frame || typeof frame !== 'object') {
      return false;
    }
    const frameRecord = frame as Record<string, unknown>;
    return readOptionalString(frameRecord.fileAssetId) === fileAssetId
      || readOptionalString(frameRecord.imageUrl) === normalizedPath;
  });
}

/** 扫描节点中对 fileAssetId 或 assets/ 路径的引用。 */
export function scanNodeAssetPathFields(nodes: CanvasNode[]): Array<{
  nodeId: string;
  field: string;
  path?: string;
  fileAssetId?: string;
}> {
  const results: Array<{
    nodeId: string;
    field: string;
    path?: string;
    fileAssetId?: string;
  }> = [];

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;

    const imageUrl = readOptionalString(data.imageUrl);
    if (imageUrl && isProjectRelativeAssetPath(imageUrl)) {
      results.push({ nodeId: node.id, field: 'imageUrl', path: normalizeAssetPath(imageUrl) });
    }

    const fileAssetId = readOptionalString(data.fileAssetId);
    if (fileAssetId) {
      results.push({ nodeId: node.id, field: 'fileAssetId', fileAssetId });
    }

    if (Array.isArray(data.frames)) {
      data.frames.forEach((frame, index) => {
        if (!frame || typeof frame !== 'object') {
          return;
        }
        const frameRecord = frame as Record<string, unknown>;
        const frameImageUrl = readOptionalString(frameRecord.imageUrl);
        if (frameImageUrl && isProjectRelativeAssetPath(frameImageUrl)) {
          results.push({
            nodeId: node.id,
            field: `frames/${index}/imageUrl`,
            path: normalizeAssetPath(frameImageUrl),
          });
        }
        const frameFileAssetId = readOptionalString(frameRecord.fileAssetId);
        if (frameFileAssetId) {
          results.push({
            nodeId: node.id,
            field: `frames/${index}/fileAssetId`,
            fileAssetId: frameFileAssetId,
          });
        }
      });
    }
  }

  return results;
}

export function listAssetRefs(manifest: AssetManifest, nodes: CanvasNode[]): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  for (const item of scanNodeAssetPathFields(nodes)) {
    let fileAssetId: string | null = null;
    if (item.fileAssetId && manifest[item.fileAssetId]) {
      fileAssetId = item.fileAssetId;
    } else if (item.path) {
      fileAssetId = findFileAssetIdByPath(manifest, item.path);
    }
    if (!fileAssetId) {
      continue;
    }

    const dedupeKey = `${item.nodeId}:${fileAssetId}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    refs.push({ nodeId: item.nodeId, field: item.field, fileAssetId });
  }
  return refs;
}

export function countRefsForFileAssetId(
  manifest: AssetManifest,
  nodes: CanvasNode[],
  fileAssetId: string
): number {
  return listAssetRefs(manifest, nodes).filter((ref) => ref.fileAssetId === fileAssetId).length;
}

function syncPathField(
  data: Record<string, unknown>,
  urlField: string,
  fileAssetIdField: string,
  manifest: AssetManifest
): boolean {
  const fileAssetId = readOptionalString(data[fileAssetIdField]);
  if (fileAssetId && !manifest[fileAssetId]) {
    data[fileAssetIdField] = null;
    return true;
  }
  if (!fileAssetId) {
    return false;
  }
  const manifestPath = resolveManifestPath(manifest, fileAssetId);
  if (!manifestPath) {
    return false;
  }
  const currentUrl = readOptionalString(data[urlField]);
  if (currentUrl === manifestPath) {
    return false;
  }
  data[urlField] = manifestPath;
  return true;
}

function syncFramePathFields(
  data: Record<string, unknown>,
  manifest: AssetManifest
): boolean {
  if (!Array.isArray(data.frames)) {
    return false;
  }

  let changed = false;
  const nextFrames = data.frames.map((frame) => {
    if (!frame || typeof frame !== 'object') {
      return frame;
    }
    const frameRecord = { ...(frame as Record<string, unknown>) };
    const frameChanged = syncPathField(frameRecord, 'imageUrl', 'fileAssetId', manifest);
    if (frameChanged) {
      changed = true;
      return frameRecord;
    }
    return frame;
  });

  if (changed) {
    data.frames = nextFrames;
  }
  return changed;
}

/** manifest 中 path 变更后，将节点 path 缓存与 fileAssetId 对齐。 */
export function syncNodeAssetPathsFromManifest(
  nodes: CanvasNode[],
  manifest: AssetManifest
): CanvasNode[] {
  let anyChanged = false;

  const nextNodes = nodes.map((node) => {
    const nextData = { ...(node.data as Record<string, unknown>) };
    let nodeChanged = false;

    if (syncPathField(nextData, 'imageUrl', 'fileAssetId', manifest)) {
      nodeChanged = true;
    }
    if (syncFramePathFields(nextData, manifest)) {
      nodeChanged = true;
    }

    if (!nodeChanged) {
      return node;
    }

    anyChanged = true;
    return { ...node, data: nextData as CanvasNode['data'] };
  });

  return anyChanged ? nextNodes : nodes;
}

function setNestedField(target: Record<string, unknown>, field: string, value: string): void {
  const segments = field.split('/');
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] ?? '';
    const nextSegment = segments[index + 1] ?? '';
    const nextIsIndex = /^\d+$/.test(nextSegment);
    if (nextIsIndex) {
      const arrayValue = Array.isArray(cursor[segment]) ? [...(cursor[segment] as unknown[])] : [];
      const arrayIndex = Number(nextSegment);
      const currentItem = arrayValue[arrayIndex];
      const nextItem =
        currentItem && typeof currentItem === 'object'
          ? { ...(currentItem as Record<string, unknown>) }
          : {};
      arrayValue[arrayIndex] = nextItem;
      cursor[segment] = arrayValue;
      cursor = nextItem;
      index += 1;
      continue;
    }
    const nextObject =
      cursor[segment] && typeof cursor[segment] === 'object'
        ? { ...(cursor[segment] as Record<string, unknown>) }
        : {};
    cursor[segment] = nextObject;
    cursor = nextObject;
  }
  cursor[segments[segments.length - 1] ?? ''] = value;
}

export function applyFileAssetIdToNodes(
  nodes: CanvasNode[],
  bindings: Array<{ nodeId: string; field: string; fileAssetId: string }>
): CanvasNode[] {
  if (bindings.length === 0) {
    return nodes;
  }
  const bindingMap = new Map<string, Map<string, string>>();
  for (const binding of bindings) {
    const nodeBindings = bindingMap.get(binding.nodeId) ?? new Map<string, string>();
    nodeBindings.set(binding.field, binding.fileAssetId);
    bindingMap.set(binding.nodeId, nodeBindings);
  }

  return nodes.map((node) => {
    const nodeBindings = bindingMap.get(node.id);
    if (!nodeBindings) {
      return node;
    }
    const nextData = { ...(node.data as Record<string, unknown>) };
    for (const [field, fileAssetId] of nodeBindings.entries()) {
      if (field === 'fileAssetId') {
        nextData.fileAssetId = fileAssetId;
      } else if (field.endsWith('/fileAssetId')) {
        setNestedField(nextData, field, fileAssetId);
      } else if (field === 'imageUrl') {
        nextData.fileAssetId = fileAssetId;
      } else if (field.endsWith('/imageUrl')) {
        setNestedField(nextData, field.replace(/\/imageUrl$/, '/fileAssetId'), fileAssetId);
      }
    }
    return { ...node, data: nextData as CanvasNode['data'] };
  });
}

const LEGACY_PREVIEW_FIELDS = ['previewImageUrl', 'previewFileAssetId'] as const;

export function stripLegacyPreviewFieldsFromNodeData(data: Record<string, unknown>): Record<string, unknown> {
  let changed = false;
  const nextData = { ...data };
  for (const field of LEGACY_PREVIEW_FIELDS) {
    if (field in nextData) {
      delete nextData[field];
      changed = true;
    }
  }

  if (Array.isArray(nextData.frames)) {
    const currentFrames = nextData.frames as unknown[];
    const nextFrames = currentFrames.map((frame) => {
      if (!frame || typeof frame !== 'object') {
        return frame;
      }
      const frameRecord = { ...(frame as Record<string, unknown>) };
      let frameChanged = false;
      for (const field of LEGACY_PREVIEW_FIELDS) {
        if (field in frameRecord) {
          delete frameRecord[field];
          frameChanged = true;
        }
      }
      return frameChanged ? frameRecord : frame;
    });
    if (nextFrames.some((frame, index) => frame !== currentFrames[index])) {
      nextData.frames = nextFrames;
      changed = true;
    }
  }

  return changed ? nextData : data;
}

export function stripLegacyPreviewFieldsFromNodes(nodes: CanvasNode[]): CanvasNode[] {
  let anyChanged = false;
  const nextNodes = nodes.map((node) => {
    const nextData = stripLegacyPreviewFieldsFromNodeData(node.data as Record<string, unknown>);
    if (nextData === node.data) {
      return node;
    }
    anyChanged = true;
    return { ...node, data: nextData as CanvasNode['data'] };
  });
  return anyChanged ? nextNodes : nodes;
}
