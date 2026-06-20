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

/** 进入重命名时：有后缀的文件只选中主文件名，目录或无后缀则全选。 */
export function focusRenameInput(
  input: HTMLInputElement,
  name: string,
  kind: 'file' | 'directory'
): void {
  input.focus();
  if (kind === 'directory') {
    input.select();
    return;
  }
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex > 0) {
    input.setSelectionRange(0, dotIndex);
    return;
  }
  input.select();
}
