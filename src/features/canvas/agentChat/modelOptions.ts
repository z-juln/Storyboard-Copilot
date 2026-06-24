export type AgentChatModelId = 'deepseek-v4-flash' | 'deepseek-v4-pro';

export interface AgentChatModelOption {
  id: AgentChatModelId;
  label: string;
  shortLabel: string;
}

export const AGENT_CHAT_MODEL_OPTIONS: AgentChatModelOption[] = [
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash · 联网',
    shortLabel: 'Flash',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro · 联网',
    shortLabel: 'Pro',
  },
];

export const AGENT_CHAT_DEFAULT_MODEL_ID: AgentChatModelId = 'deepseek-v4-flash';

export const AGENT_CHAT_MODEL_STORAGE_KEY = 'storyboard-copilot:agent-chat-model';

export function isAgentChatModelId(value: string): value is AgentChatModelId {
  return value === 'deepseek-v4-flash' || value === 'deepseek-v4-pro';
}

export function resolveAgentChatModelLabel(modelId: AgentChatModelId): string {
  return (
    AGENT_CHAT_MODEL_OPTIONS.find((option) => option.id === modelId)?.label ??
    AGENT_CHAT_MODEL_OPTIONS[0].label
  );
}

export function loadAgentChatModelId(): AgentChatModelId {
  if (typeof window === 'undefined') {
    return AGENT_CHAT_DEFAULT_MODEL_ID;
  }

  const stored = window.localStorage.getItem(AGENT_CHAT_MODEL_STORAGE_KEY);
  return stored && isAgentChatModelId(stored) ? stored : AGENT_CHAT_DEFAULT_MODEL_ID;
}

export function saveAgentChatModelId(modelId: AgentChatModelId): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(AGENT_CHAT_MODEL_STORAGE_KEY, modelId);
}
