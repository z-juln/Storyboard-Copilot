export type Modality = 'text' | 'image' | 'video' | 'audio';

export type ModelCapability =
  | 'chat'
  | 'multimodal-chat'
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'text-to-audio'
  | 'audio-to-text';

export type ModelOutput =
  | { type: 'text'; text: string }
  | { type: 'image'; url?: string; dataUrl?: string }
  | { type: 'video'; url?: string }
  | { type: 'audio'; url?: string; dataUrl?: string };

export type ModelCallResult =
  | {
      status: 'succeeded';
      outputs: ModelOutput[];
      raw?: unknown;
    }
  | {
      status: 'queued' | 'running';
      task: {
        id: string;
        pollAfterMs?: number;
        providerState?: unknown;
      };
      raw?: unknown;
    }
  | {
      status: 'failed';
      error: string;
      details?: string;
      raw?: unknown;
    };

export interface ModelInvokeInput {
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  aspectRatio?: string;
  size?: string;
  resolution?: string;
}

export interface BuiltinAdapterSummary {
  id: string;
  displayName: string;
  capability: ModelCapability;
  providerId: string;
  modelId: string;
  locked: boolean;
}

export interface ProviderSecretStatus {
  providerId: string;
  hasOverride: boolean;
  hasBuiltin: boolean;
  usingBuiltin: boolean;
}

export const DEEPSEEK_FLASH_ADAPTER_ID = 'deepseek/deepseek-v4-flash/chat';
export const KLING_V3_T2V_ADAPTER_ID = 'kling/kling-v3/text-to-video';

export const BUILTIN_ADAPTER_SUMMARIES: BuiltinAdapterSummary[] = [
  {
    id: DEEPSEEK_FLASH_ADAPTER_ID,
    displayName: 'DeepSeek V4 Flash / Chat',
    capability: 'chat',
    providerId: 'deepseek',
    modelId: 'deepseek/deepseek-v4-flash',
    locked: true,
  },
  {
    id: KLING_V3_T2V_ADAPTER_ID,
    displayName: 'Kling 3.0 / 文生视频',
    capability: 'text-to-video',
    providerId: 'kling',
    modelId: 'kling/kling-v3',
    locked: true,
  },
];
