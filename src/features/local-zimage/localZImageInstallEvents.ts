export interface OpenLocalZImageInstallDetail {
  /** 打开后自动聚焦到当前推荐步骤 */
  focusCurrentStep?: boolean;
}

const OPEN_LOCAL_ZIMAGE_INSTALL_EVENT = 'storyboard:open-local-zimage-install';

export function openLocalZImageInstallDialog(
  detail: OpenLocalZImageInstallDetail = {}
): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OpenLocalZImageInstallDetail>(OPEN_LOCAL_ZIMAGE_INSTALL_EVENT, { detail })
  );
}

export function subscribeOpenLocalZImageInstallDialog(
  callback: (detail: OpenLocalZImageInstallDetail) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<OpenLocalZImageInstallDetail>;
    callback(customEvent.detail ?? {});
  };

  window.addEventListener(OPEN_LOCAL_ZIMAGE_INSTALL_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(OPEN_LOCAL_ZIMAGE_INSTALL_EVENT, handler as EventListener);
  };
}
