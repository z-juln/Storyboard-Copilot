import type { SettingsCategory } from '@/features/settings/settingsEvents';

export const PROVIDER_REGISTER_URLS: Record<string, string> = {
  ppio: 'https://ppio.com/user/register?invited_by=WGY0DZ',
  grsai: 'https://grsai.com',
  kie: 'https://kie.ai?ref=eef20ef0b0595cad227d45b29c635f6c',
  fal: 'https://fal.ai',
};

export const PROVIDER_GET_KEY_URLS: Record<string, string> = {
  ppio: 'https://ppio.com/settings/key-management',
  grsai: 'https://grsai.com/zh/dashboard/api-keys',
  kie: 'https://kie.ai/api-key',
  fal: 'https://fal.ai/dashboard/keys',
};

export const SETTINGS_NAV_ITEMS: Array<{ id: SettingsCategory; label: string }> = [
  { id: 'general', label: '通用' },
  { id: 'providers', label: '密钥' },
  { id: 'aiModels', label: '模型' },
  { id: 'appearance', label: '外观' },
  { id: 'pricing', label: '价格' },
  { id: 'experimental', label: '实验' },
  { id: 'about', label: '关于' },
];
