export type AssetPreviewKind = 'image' | 'video' | 'audio' | 'text';

const IMAGE_PATTERN = /\.(png|jpe?g|webp|gif|bmp|avif|tiff?|svg)$/i;
const VIDEO_PATTERN = /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i;
const AUDIO_PATTERN = /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba)$/i;
const TEXT_PATTERN =
  /\.(txt|md|markdown|json|jsonc|xml|html?|css|js|mjs|cjs|ts|tsx|jsx|yaml|yml|csv|log|rs|toml|ini|env|sh|bat|sql|graphql|glsl|wgsl|vue|svelte)$/i;

export function resolveAssetPreviewKind(fileName: string): AssetPreviewKind | null {
  if (IMAGE_PATTERN.test(fileName)) {
    return 'image';
  }
  if (VIDEO_PATTERN.test(fileName)) {
    return 'video';
  }
  if (AUDIO_PATTERN.test(fileName)) {
    return 'audio';
  }
  if (TEXT_PATTERN.test(fileName)) {
    return 'text';
  }
  return null;
}

export function isAssetPreviewable(fileName: string): boolean {
  return resolveAssetPreviewKind(fileName) !== null;
}

export const MAX_TEXT_PREVIEW_CHARS = 512_000;
