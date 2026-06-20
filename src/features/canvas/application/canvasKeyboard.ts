export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }
  const tagName = element.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
}

export function isAssetExplorerKeyboardTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest('[data-asset-explorer-root]'));
}

export function shouldHandleCanvasShortcut(target: EventTarget | null): boolean {
  return !isTypingTarget(target) && !isAssetExplorerKeyboardTarget(target);
}
