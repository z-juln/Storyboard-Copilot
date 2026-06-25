import type { SettingsCategory } from '@/features/settings/settingsEvents';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: SettingsCategory;
  onCheckUpdate?: () => Promise<'has-update' | 'up-to-date' | 'failed'>;
}

export type CheckUpdateStatus = '' | 'checking' | 'has-update' | 'up-to-date' | 'failed';

export type { SettingsCategory };
