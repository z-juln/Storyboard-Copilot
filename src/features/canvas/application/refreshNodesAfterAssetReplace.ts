import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import { detectAspectRatio, resolveNodeImageDisplayUrl } from '@/features/canvas/application/imageData';
import { normalizeAssetPath } from '@/features/project/asset';
import type { ReplaceableAssetKind } from '@/features/project/asset/replaceProjectAssetFile';
import { loadProjectAssetTextContent } from '@/features/project/asset/textAssetContent';
import { useCanvasStore, type CanvasNode } from '@/stores/canvasStore';

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nodeReferencesAsset(
  node: CanvasNode,
  fileAssetId: string,
  path: string
): boolean {
  const data = node.data as Record<string, unknown>;
  const nodeFileAssetId = readOptionalString(data.fileAssetId);
  const nodeImageUrl = readOptionalString(data.imageUrl);
  if (nodeFileAssetId === fileAssetId || nodeImageUrl === path) {
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
      || readOptionalString(frameRecord.imageUrl) === path;
  });
}

async function resolveImageAspectRatio(
  path: string,
  fileAssetId: string
): Promise<string | null> {
  const displayUrl = resolveNodeImageDisplayUrl({
    imageUrl: path,
    fileAssetId,
    preferOriginal: true,
  });
  if (!displayUrl) {
    return null;
  }

  try {
    return await detectAspectRatio(displayUrl);
  } catch {
    return null;
  }
}

function buildImageReplacePatch(
  data: Record<string, unknown>,
  fileAssetId: string,
  path: string,
  aspectRatio: string | null
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  let changed = false;

  const nodeFileAssetId = readOptionalString(data.fileAssetId);
  const nodeImageUrl = readOptionalString(data.imageUrl);
  if (nodeFileAssetId === fileAssetId || nodeImageUrl === path) {
    if (aspectRatio) {
      patch.aspectRatio = aspectRatio;
    }
    changed = true;
  }

  if (Array.isArray(data.frames)) {
    let framesChanged = false;
    const nextFrames = data.frames.map((frame) => {
      if (!frame || typeof frame !== 'object') {
        return frame;
      }
      const frameRecord = frame as Record<string, unknown>;
      const frameFileAssetId = readOptionalString(frameRecord.fileAssetId);
      const frameImageUrl = readOptionalString(frameRecord.imageUrl);
      if (frameFileAssetId !== fileAssetId && frameImageUrl !== path) {
        return frame;
      }
      framesChanged = true;
      if (!aspectRatio) {
        return frame;
      }
      return { ...frameRecord, aspectRatio };
    });
    if (framesChanged) {
      patch.frames = nextFrames;
      changed = true;
    }
  }

  return changed ? patch : null;
}

export async function refreshCanvasNodesAfterAssetReplace(input: {
  projectId: string;
  path: string;
  fileAssetId: string;
  updatedAt: number;
  kind: ReplaceableAssetKind;
}): Promise<void> {
  const normalizedPath = normalizeAssetPath(input.path);
  const { nodes, updateNodeData } = useCanvasStore.getState();

  if (input.kind === 'text') {
    const remoteContent = await loadProjectAssetTextContent(input.projectId, normalizedPath);
    canvasEventBus.publish('text-asset/updated', {
      path: normalizedPath,
      updatedAt: input.updatedAt,
    });

    for (const node of nodes) {
      if (!nodeReferencesAsset(node, input.fileAssetId, normalizedPath)) {
        continue;
      }
      if (remoteContent === null) {
        continue;
      }
      updateNodeData(node.id, {
        textContent: remoteContent,
        textSyncedAt: input.updatedAt,
      });
    }
    return;
  }

  const aspectRatio = await resolveImageAspectRatio(normalizedPath, input.fileAssetId);

  for (const node of nodes) {
    if (!nodeReferencesAsset(node, input.fileAssetId, normalizedPath)) {
      continue;
    }
    const patch = buildImageReplacePatch(
      node.data as Record<string, unknown>,
      input.fileAssetId,
      normalizedPath,
      aspectRatio
    );
    if (patch) {
      updateNodeData(node.id, patch);
    }
  }

  canvasEventBus.publish('asset-file/replaced', {
    path: normalizedPath,
    fileAssetId: input.fileAssetId,
    updatedAt: input.updatedAt,
  });
}
