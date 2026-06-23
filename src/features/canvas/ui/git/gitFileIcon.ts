import type { LucideIcon } from 'lucide-react';
import {
  Braces,
  File,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
} from 'lucide-react';

function resolveExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
}

export function resolveGitFileIcon(fileName: string): LucideIcon {
  if (fileName === 'project.json') {
    return Braces;
  }

  const ext = resolveExtension(fileName);
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return FileImage;
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
    return FileVideo;
  }
  if (['txt', 'md', 'markdown'].includes(ext)) {
    return FileText;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'rs', 'py', 'json', 'css', 'html', 'yaml', 'yml'].includes(ext)) {
    return FileCode2;
  }
  return File;
}

export function resolveGitFileIconClassName(fileName: string): string {
  if (fileName === 'project.json') {
    return 'text-amber-300';
  }

  const ext = resolveExtension(fileName);
  if (['tsx', 'jsx'].includes(ext)) {
    return 'text-sky-400';
  }
  if (ext === 'ts') {
    return 'text-sky-300';
  }
  if (['js', 'jsx'].includes(ext)) {
    return 'text-amber-300';
  }
  if (ext === 'rs') {
    return 'text-orange-400';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'text-emerald-400';
  }
  return 'text-text-muted';
}
