import { invoke } from '@tauri-apps/api/core';

import {
  rustApiClient,
  type MergeStoryboardImagesPayload,
  type MergeStoryboardImagesResult,
  type StoryboardImageMetadata,
} from '@/infrastructure/rustApiClient';
import { useProjectStore } from '@/stores/projectStore';

export type {
  MergeStoryboardImagesPayload,
  MergeStoryboardImagesResult,
  StoryboardImageMetadata,
};

export interface CropImageSourcePayload {
  source: string;
  aspectRatio?: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

function requireCurrentProjectId(): string {
  const projectId = useProjectStore.getState().currentProjectId;
  if (!projectId) {
    throw new Error('未打开项目，无法处理图片');
  }
  return projectId;
}

export async function splitImage(
  imageBase64: string,
  rows: number,
  cols: number,
  lineThickness = 0
): Promise<string[]> {
  return await invoke('split_image', {
    imageBase64,
    rows,
    cols,
    lineThickness,
  });
}

export async function splitImageSource(
  source: string,
  rows: number,
  cols: number,
  lineThickness = 0
): Promise<string[]> {
  return await invoke('split_image_source', {
    source,
    rows,
    cols,
    lineThickness,
  });
}

export async function mergeStoryboardImages(
  payload: MergeStoryboardImagesPayload
): Promise<MergeStoryboardImagesResult> {
  return rustApiClient.mergeStoryboardImages(requireCurrentProjectId(), payload);
}

export async function readStoryboardImageMetadata(
  source: string
): Promise<StoryboardImageMetadata | null> {
  return await invoke('read_storyboard_image_metadata', { source });
}

export async function embedStoryboardImageMetadata(
  source: string,
  metadata: StoryboardImageMetadata
): Promise<string> {
  return rustApiClient.embedStoryboardImageMetadata(requireCurrentProjectId(), source, metadata);
}

export async function cropImageSource(
  payload: CropImageSourcePayload
): Promise<string> {
  return await invoke('crop_image_source', { payload });
}

export async function persistImageBinary(
  bytes: Uint8Array,
  extension = 'png'
): Promise<string> {
  return await invoke('persist_image_binary', {
    bytes: Array.from(bytes),
    extension,
  });
}

export async function saveImageSourceToDownloads(
  source: string,
  suggestedFileName?: string
): Promise<string> {
  return await invoke('save_image_source_to_downloads', {
    source,
    suggestedFileName,
  });
}

export async function saveImageSourceToPath(
  source: string,
  targetPath: string
): Promise<string> {
  return await invoke('save_image_source_to_path', {
    source,
    targetPath,
  });
}

export async function saveImageSourceToDirectory(
  source: string,
  targetDir: string,
  suggestedFileName?: string
): Promise<string> {
  return await invoke('save_image_source_to_directory', {
    source,
    targetDir,
    suggestedFileName,
  });
}

export async function saveImageSourceToAppDebugDir(
  source: string,
  category = 'grid',
  suggestedFileName?: string
): Promise<string> {
  return await invoke('save_image_source_to_app_debug_dir', {
    source,
    category,
    suggestedFileName,
  });
}

export async function copyImageSourceToClipboard(source: string): Promise<void> {
  await invoke('copy_image_source_to_clipboard', { source });
}
