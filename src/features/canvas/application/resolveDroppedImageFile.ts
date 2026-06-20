interface DragTransferEvent {
  dataTransfer: DataTransfer | null;
}

export function hasExternalImageDrop(event: DragTransferEvent): boolean {
  const types = Array.from(event.dataTransfer?.types ?? []);
  if (types.includes('Files') || types.includes('application/x-moz-file')) {
    return true;
  }

  return types.includes('text/uri-list');
}

export function resolveDroppedImageFile(event: DragTransferEvent): File | null {
  const directFile = event.dataTransfer?.files?.[0];
  if (directFile?.type.startsWith('image/')) {
    return directFile;
  }

  const item = Array.from(event.dataTransfer?.items ?? []).find(
    (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/')
  );
  return item?.getAsFile() ?? null;
}
