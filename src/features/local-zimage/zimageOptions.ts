export const ZIMAGE_SIZE_OPTIONS = [
  { value: 512, label: '512（快，预览）' },
  { value: 768, label: '768（推荐）' },
  { value: 1024, label: '1024（慢，高清）' },
] as const;

export type ZImageSize = (typeof ZIMAGE_SIZE_OPTIONS)[number]['value'];

export const DEFAULT_ZIMAGE_SIZE: ZImageSize = 768;

export function normalizeZImageSize(value: unknown): ZImageSize {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (parsed === 512 || parsed === 768 || parsed === 1024) {
    return parsed;
  }
  return DEFAULT_ZIMAGE_SIZE;
}

export function estimateZImageDurationMs(size: ZImageSize): number {
  switch (size) {
    case 512:
      return 180_000;
    case 768:
      return 300_000;
    case 1024:
      return 480_000;
    default:
      return 300_000;
  }
}
