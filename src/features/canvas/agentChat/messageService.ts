import type { ModelInvokeInput } from '@/features/aiModels';
import { rustApiClient } from '@/infrastructure/rustApiClient';

import { AGENT_CHAT_ADAPTER_ID, AGENT_CHAT_SYSTEM_PROMPT } from './constants';
import { createAgentChatId } from './id';
import type { AgentChatMessage } from './types';

function buildInvokeMessages(
  history: AgentChatMessage[],
  userContent: string,
): ModelInvokeInput['messages'] {
  return [
    { role: 'system', content: AGENT_CHAT_SYSTEM_PROMPT },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: 'user', content: userContent },
  ];
}

export async function invokeAgentChatReply(
  history: AgentChatMessage[],
  userContent: string,
): Promise<
  | { assistantMessage: AgentChatMessage }
  | { error: string }
> {
  const trimmed = userContent.trim();
  if (!trimmed) {
    return { error: '请输入消息内容' };
  }

  try {
    const result = await rustApiClient.invokeAdapter({
      adapterId: AGENT_CHAT_ADAPTER_ID,
      input: {
        messages: buildInvokeMessages(history, trimmed),
      },
    });

    if (result.status === 'succeeded') {
      const textOutput = result.outputs.find((output) => output.type === 'text');
      const text =
        textOutput?.type === 'text'
          ? textOutput.text
          : JSON.stringify(result.outputs);

      return {
        assistantMessage: {
          id: createAgentChatId('msg'),
          role: 'assistant',
          content: text,
        },
      };
    }

    if (result.status === 'failed') {
      return { error: result.error };
    }

    return { error: '模型返回了未完成的异步任务，当前对话仅支持同步回复。' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createUserMessage(content: string): AgentChatMessage {
  return {
    id: createAgentChatId('msg'),
    role: 'user',
    content: content.trim(),
  };
}
