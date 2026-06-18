import { useLayoutEffect } from 'react';

/** Single source of truth for desktop top chrome (TitleBar / web top nav). */
export const APP_TOP_CHROME_HEIGHT = '30px';

export const APP_TOP_CHROME_HEIGHT_VAR = '--app-top-chrome-height';

export const APP_TOP_CHROME_HEIGHT_CLASS = 'app-top-chrome-height';

export const UI_CONTENT_OVERLAY_INSET_CLASS = 'ui-content-overlay-inset';

export function syncAppTopChromeHeight(active: boolean) {
  document.documentElement.style.setProperty(
    APP_TOP_CHROME_HEIGHT_VAR,
    active ? APP_TOP_CHROME_HEIGHT : '0px',
  );
}

export function useAppTopChromeHeight(active = true) {
  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    syncAppTopChromeHeight(true);
    return () => syncAppTopChromeHeight(false);
  }, [active]);
}
