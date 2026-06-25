import { Music, Video, type LucideIcon } from 'lucide-react';

import {
  importNodeMediaFromFile,
  isMediaUploadFile,
  type UploadMediaFileKind,
} from '@/features/canvas/application/importNodeMediaFromFile';
import { CANVAS_NODE_TYPES } from '@/features/canvas/domain/canvasNodes';
import type { AssetManifest } from '@/features/project/asset';

export interface UploadMediaNodeConfig {
  mediaKind: UploadMediaFileKind;
  nodeType: typeof CANVAS_NODE_TYPES.uploadVideo | typeof CANVAS_NODE_TYPES.uploadAudio;
  defaultAspectRatio: string;
  uploadLabel: string;
  previewFallbackTitle: string;
  emptyUploadHint: string;
  logTag: string;
  HeaderIcon: LucideIcon;
  EmptyIcon: LucideIcon;
  isValidFile: (file: File) => boolean;
  importFromFile: (input: {
    projectId: string;
    file: File;
    manifest: AssetManifest;
  }) => ReturnType<typeof importNodeMediaFromFile>;
}

export const UPLOAD_MEDIA_NODE_CONFIG: Record<UploadMediaFileKind, UploadMediaNodeConfig> = {
  video: {
    mediaKind: 'video',
    nodeType: CANVAS_NODE_TYPES.uploadVideo,
    defaultAspectRatio: '16:9',
    uploadLabel: '视频',
    previewFallbackTitle: '视频预览',
    emptyUploadHint: '点击或拖拽上传视频',
    logTag: 'upload-video',
    HeaderIcon: Video,
    EmptyIcon: Video,
    isValidFile: (file) => isMediaUploadFile(file, 'video'),
    importFromFile: (input) => importNodeMediaFromFile({ ...input, kind: 'video' }),
  },
  audio: {
    mediaKind: 'audio',
    nodeType: CANVAS_NODE_TYPES.uploadAudio,
    defaultAspectRatio: '16:3',
    uploadLabel: '音频',
    previewFallbackTitle: '音频预览',
    emptyUploadHint: '点击或拖拽上传音频',
    logTag: 'upload-audio',
    HeaderIcon: Music,
    EmptyIcon: Music,
    isValidFile: (file) => isMediaUploadFile(file, 'audio'),
    importFromFile: (input) => importNodeMediaFromFile({ ...input, kind: 'audio' }),
  },
};
