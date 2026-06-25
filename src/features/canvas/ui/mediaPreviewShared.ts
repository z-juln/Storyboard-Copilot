import type { AssetPreviewKind } from '@/features/project/asset/assetPreviewUtils';

export type MediaPreviewKind = AssetPreviewKind;

export const PREVIEW_MEDIA_FRAME_CLASS =
  'flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-bg-dark/40';

export const PREVIEW_TEXT_READONLY_CLASS =
  'ui-scrollbar min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-relaxed text-text-dark';

export function resolveMediaPreviewTitle(fileName?: string | null, fallback = '预览'): string {
  const trimmed = typeof fileName === 'string' ? fileName.trim() : '';
  return trimmed ? `预览 · ${trimmed}` : fallback;
}
