import { File, FileText, Image as ImageIcon, Music, Video } from 'lucide-react';

import { resolveAssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

export function splitAssetFileName(name: string): { stem: string; extension: string } {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return { stem: name, extension: '' };
  }
  return {
    stem: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

const FILE_ICON_CLASS = 'h-3.5 w-3.5 text-text-muted';

export function AssetExplorerFileIcon({ fileName }: { fileName: string }) {
  const kind = resolveAssetPreviewKind(fileName);

  if (kind === 'image') {
    return <ImageIcon className={FILE_ICON_CLASS} />;
  }
  if (kind === 'video') {
    return <Video className={FILE_ICON_CLASS} />;
  }
  if (kind === 'audio') {
    return <Music className={FILE_ICON_CLASS} />;
  }
  if (kind === 'text') {
    return <FileText className={FILE_ICON_CLASS} />;
  }

  return <File className={FILE_ICON_CLASS} />;
}

export function AssetExplorerTruncatedFileName({ name }: { name: string }) {
  const { stem, extension } = splitAssetFileName(name);

  if (!extension) {
    return <span className="min-w-0 flex-1 truncate">{name}</span>;
  }

  return (
    <span className="flex min-w-0 flex-1 items-center overflow-hidden">
      <span className="min-w-0 truncate">{stem}</span>
      <span className="shrink-0">{extension}</span>
    </span>
  );
}
