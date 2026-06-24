import { useCallback, useState } from 'react';

import {
  AGENT_CHAT_DEFAULT_MODEL_ID,
  loadAgentChatModelId,
  saveAgentChatModelId,
  type AgentChatModelId,
} from './modelOptions';

export function useAgentChatModel() {
  const [modelId, setModelId] = useState<AgentChatModelId>(() => loadAgentChatModelId());

  const selectModel = useCallback((nextModelId: AgentChatModelId) => {
    setModelId(nextModelId);
    saveAgentChatModelId(nextModelId);
  }, []);

  return {
    modelId,
    selectModel,
    defaultModelId: AGENT_CHAT_DEFAULT_MODEL_ID,
  };
}
