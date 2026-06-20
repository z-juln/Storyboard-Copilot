import type { UploadImageNodeData, UploadMediaKind } from '@/features/canvas/domain/canvasNodes';
import {
  findFileAssetIdByPath,
  registerFileAssetPath,
  type AssetManifest,
} from '@/features/project/asset';
import {
  MAX_TEXT_PREVIEW_CHARS,
  type AssetPreviewKind,
} from '@/features/project/asset/assetPreviewUtils';
import { buildProjectAssetUrl } from '@/features/project/projectPaths';

export const PROJECT_ASSET_DRAG_MIME = 'application/x-storyboard-copilot-asset';

export interface ProjectAssetDragPayload {
  path: string;
  name: string;
  mediaKind: AssetPreviewKind;
}

export function serializeProjectAssetDragPayload(payload: ProjectAssetDragPayload): string {
  return JSON.stringify(payload);
}

export function parseProjectAssetDragPayload(raw: string): ProjectAssetDragPayload | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProjectAssetDragPayload>;
    if (
      typeof parsed.path === 'string'
      && typeof parsed.name === 'string'
      && parsed.mediaKind
      && ['image', 'video', 'audio', 'text'].includes(parsed.mediaKind)
    ) {
      return parsed as ProjectAssetDragPayload;
    }
  } catch {
    // ignore malformed payload
  }

  return null;
}

function resolveAspectRatioForMediaKind(mediaKind: UploadMediaKind): string {
  if (mediaKind === 'video') {
    return '16:9';
  }
  return '1:1';
}

export async function buildUploadNodeDataFromProjectAsset(input: {
  projectId: string;
  path: string;
  name: string;
  mediaKind: UploadMediaKind;
  manifest: AssetManifest;
}): Promise<{
  nodeData: Partial<UploadImageNodeData>;
  manifest: AssetManifest;
  manifestChanged: boolean;
}> {
  let manifest = input.manifest;
  let manifestChanged = false;

  let fileAssetId = findFileAssetIdByPath(manifest, input.path);
  if (!fileAssetId) {
    const registered = registerFileAssetPath(manifest, input.path);
    manifest = registered.manifest;
    fileAssetId = registered.fileAssetId;
    manifestChanged = registered.created;
  }

  const nodeData: Partial<UploadImageNodeData> = {
    imageUrl: input.path,
    previewImageUrl: input.mediaKind === 'image' ? input.path : null,
    fileAssetId,
    previewFileAssetId: input.mediaKind === 'image' ? fileAssetId : null,
    sourceFileName: input.name,
    displayName: input.name,
    mediaKind: input.mediaKind,
    aspectRatio: resolveAspectRatioForMediaKind(input.mediaKind),
    isSizeManuallyAdjusted: false,
  };

  if (input.mediaKind === 'text') {
    const response = await fetch(buildProjectAssetUrl(input.projectId, input.path));
    if (response.ok) {
      const raw = await response.text();
      nodeData.textContent = raw.length > MAX_TEXT_PREVIEW_CHARS
        ? `${raw.slice(0, MAX_TEXT_PREVIEW_CHARS)}\n\n…（内容过长，已截断）`
        : raw;
    }
  }

  return { nodeData, manifest, manifestChanged };
}
