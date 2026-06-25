import { isBindableTextAssetFileName, resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

interface DragTransferEvent {
  dataTransfer: DataTransfer | null;
}

function readFirstDroppedFile(event: DragTransferEvent): File | null {
  const directFile = event.dataTransfer?.files?.[0];
  if (directFile) {
    return directFile;
  }

  const item = Array.from(event.dataTransfer?.items ?? []).find(
    (candidate) => candidate.kind === 'file'
  );
  return item?.getAsFile() ?? null;
}

export function hasExternalFileDrop(event: DragTransferEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  if (types.includes('Files') || types.includes('application/x-moz-file')) {
    return true;
  }

  return types.includes('text/uri-list');
}

/** @deprecated 使用 hasExternalFileDrop */
export const hasExternalImageDrop = hasExternalFileDrop;

export function resolveDroppedExternalFile(event: DragTransferEvent): File | null {
  const file = readFirstDroppedFile(event);
  if (!file) {
    return null;
  }

  if (file.type.startsWith('image/')) {
    return file;
  }

  if (file.type.startsWith('video/') || resolveAssetPreviewKind(file.name) === 'video') {
    return file;
  }

  if (isBindableTextAssetFileName(file.name)) {
    return file;
  }

  return null;
}

export function resolveDroppedImageFile(event: DragTransferEvent): File | null {
  const file = resolveDroppedExternalFile(event);
  if (!file?.type.startsWith('image/')) {
    return null;
  }
  return file;
}
