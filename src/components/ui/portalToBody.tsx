import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface UiBodyPortalProps {
  children: ReactNode;
}

/** Mount overlay UI on document.body so fixed positioning is viewport-relative. */
export function UiBodyPortal({ children }: UiBodyPortalProps) {
  if (typeof document === 'undefined') {
    return children;
  }

  return createPortal(children, document.body);
}
