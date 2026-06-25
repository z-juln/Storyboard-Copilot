import { X } from 'lucide-react';

import { UI_CONTENT_OVERLAY_INSET_CLASS, UI_DIALOG_TRANSITION_MS } from '@/components/ui/motion';
import { UiBodyPortal } from '@/components/ui/portalToBody';
import { useDialogTransition } from '@/components/ui/useDialogTransition';
import { useSettingsStore } from '@/stores/settingsStore';

import { ProviderGuidePopover } from './ProviderGuidePopover';
import { SettingsDialogContent } from './panels/SettingsDialogContent';
import { SettingsSidebar } from './SettingsSidebar';
import type { SettingsDialogProps } from './types';
import { useSettingsDialogState } from './useSettingsDialogState';

export function SettingsDialog({
  isOpen,
  onClose,
  initialCategory = 'general',
  onCheckUpdate,
}: SettingsDialogProps) {
  const hideProviderGuidePopover = useSettingsStore((store) => store.hideProviderGuidePopover);
  const { shouldRender, isVisible } = useDialogTransition(isOpen, UI_DIALOG_TRANSITION_MS);
  const state = useSettingsDialogState(isOpen, initialCategory, onClose, onCheckUpdate);

  if (!shouldRender) {
    return null;
  }

  const showProviderGuide =
    state.activeCategory === 'providers' && !hideProviderGuidePopover;

  return (
    <UiBodyPortal>
      <div className={`fixed ${UI_CONTENT_OVERLAY_INSET_CLASS} z-50 flex items-center justify-center`}>
        <div
          className={`absolute inset-0 bg-black/90 transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />
        <div className="relative w-[min(96vw,1120px)]">
          <div
            className={`relative mx-auto flex h-[500px] w-[700px] overflow-hidden rounded-lg border border-border-dark bg-surface-dark shadow-xl transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded p-1 transition-colors hover:bg-bg-dark"
            >
              <X className="h-5 w-5 text-text-muted" />
            </button>

            <SettingsSidebar
              activeCategory={state.activeCategory}
              onCategoryChange={state.setActiveCategory}
            />

            <div className="flex flex-1 flex-col">
              <SettingsDialogContent state={state} onClose={onClose} />
            </div>
          </div>

          {showProviderGuide ? <ProviderGuidePopover visible={isVisible} /> : null}
        </div>
      </div>
    </UiBodyPortal>
  );
}
