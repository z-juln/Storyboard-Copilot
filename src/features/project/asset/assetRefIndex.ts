import type { CanvasNode } from '@/stores/canvasStore';
import { isProjectRelativeAssetPath } from '@/features/project/projectPaths';

import type { AssetManifest, AssetRef } from './types';
import { findFileAssetIdByPath, normalizeAssetPath } from './assetManifest';

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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
    const previewImageUrl = readOptionalString(data.previewImageUrl);
    if (previewImageUrl && isProjectRelativeAssetPath(previewImageUrl)) {
      results.push({
        nodeId: node.id,
        field: 'previewImageUrl',
        path: normalizeAssetPath(previewImageUrl),
      });
    }

    const fileAssetId = readOptionalString(data.fileAssetId);
    if (fileAssetId) {
      results.push({ nodeId: node.id, field: 'fileAssetId', fileAssetId });
    }
    const previewFileAssetId = readOptionalString(data.previewFileAssetId);
    if (previewFileAssetId) {
      results.push({ nodeId: node.id, field: 'previewFileAssetId', fileAssetId: previewFileAssetId });
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
        const framePreview = readOptionalString(frameRecord.previewImageUrl);
        if (framePreview && isProjectRelativeAssetPath(framePreview)) {
          results.push({
            nodeId: node.id,
            field: `frames/${index}/previewImageUrl`,
            path: normalizeAssetPath(framePreview),
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
  for (const item of scanNodeAssetPathFields(nodes)) {
    if (item.fileAssetId && manifest[item.fileAssetId]) {
      refs.push({ nodeId: item.nodeId, field: item.field, fileAssetId: item.fileAssetId });
      continue;
    }
    if (item.path) {
      const fileAssetId = findFileAssetIdByPath(manifest, item.path);
      if (fileAssetId) {
        refs.push({ nodeId: item.nodeId, field: item.field, fileAssetId });
      }
    }
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
      if (field === 'fileAssetId' || field === 'previewFileAssetId') {
        nextData[field] = fileAssetId;
      } else if (field.endsWith('/fileAssetId')) {
        setNestedField(nextData, field, fileAssetId);
      } else if (field === 'imageUrl') {
        nextData.fileAssetId = fileAssetId;
      } else if (field === 'previewImageUrl') {
        nextData.previewFileAssetId = fileAssetId;
      } else if (field.endsWith('/imageUrl')) {
        setNestedField(nextData, field.replace(/\/imageUrl$/, '/fileAssetId'), fileAssetId);
      } else if (field.endsWith('/previewImageUrl')) {
        setNestedField(
          nextData,
          field.replace(/\/previewImageUrl$/, '/previewFileAssetId'),
          fileAssetId
        );
      }
    }
    return { ...node, data: nextData as CanvasNode['data'] };
  });
}
