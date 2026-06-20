export function formatBytes(size?: number): string {
  if (!size || size <= 0) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFileName(name: string): boolean {
  return /\.(png|jpe?g|webp|gif|bmp|avif|tiff?)$/i.test(name);
}
