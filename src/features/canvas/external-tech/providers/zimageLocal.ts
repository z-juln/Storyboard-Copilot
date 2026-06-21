import type { ExternalTechProviderDefinition } from '../types';

export const ZIMAGE_LOCAL_PROVIDER_ID = 'zimage-local';

export const zimageLocalProviderDefinition: ExternalTechProviderDefinition = {
  id: ZIMAGE_LOCAL_PROVIDER_ID,
  label: 'Z-Image 本地',
  description: '调用本机 Gradio 服务（需在设置中安装并启动本地 Z-Image）',
  embedUrl: 'http://127.0.0.1:7860',
  runner: 'local-zimage',
  defaultPrompt: '',
  inputs: [{ id: 'prompt', kind: 'text', label: '提示词', required: true }],
  outputs: [{ id: 'image', kind: 'image', label: '生成图片' }],
};
