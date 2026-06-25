import {
  CANVAS_NODE_TYPES,
  type CanvasNodeType,
  type UploadImageNodeData,
  type UploadMediaKind,
} from '@/features/canvas/domain/canvasNodes';
import {
  findFileAssetIdByPath,
  registerFileAssetPath,
  type AssetManifest,
} from '@/features/project/asset';
import {
  fetchAssetTextContent,
  type AssetPreviewKind,
} from '@/features/project/asset/assetPreviewUtils';

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
  if (mediaKind === 'audio') {
    return '16:3';
  }
  return '1:1';
}

export function resolveUploadNodeTypeForMediaKind(mediaKind: AssetPreviewKind): CanvasNodeType {
  if (mediaKind === 'video') {
    return CANVAS_NODE_TYPES.uploadVideo;
  }
  if (mediaKind === 'audio') {
    return CANVAS_NODE_TYPES.uploadAudio;
  }
  return CANVAS_NODE_TYPES.upload;
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
    fileAssetId,
    sourceFileName: input.name,
    displayName: input.name,
    mediaKind: input.mediaKind,
    aspectRatio: resolveAspectRatioForMediaKind(input.mediaKind),
    isSizeManuallyAdjusted: false,
  };

  if (input.mediaKind === 'text') {
    nodeData.textContent = await fetchAssetTextContent(input.projectId, input.path);
  }

  return { nodeData, manifest, manifestChanged };
}
