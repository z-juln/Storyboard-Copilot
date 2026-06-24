import type { ModelInvokeInput } from '@/features/aiModels';
import { rustApiClient } from '@/infrastructure/rustApiClient';

import { AGENT_CHAT_ADAPTER_ID, AGENT_CHAT_ENABLE_WEB_SEARCH, AGENT_CHAT_SYSTEM_PROMPT } from './constants';
import { createAgentChatId } from './id';
import type { AgentChatMessage } from './types';

const SHANGHAI_TIME_ZONE = 'Asia/Shanghai';

function formatShanghaiNow(): string {
  const now = new Date();
  const date = now.toLocaleDateString('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const time = now.toLocaleTimeString('zh-CN', {
    timeZone: SHANGHAI_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

function buildSystemPrompt(): string {
  return `${AGENT_CHAT_SYSTEM_PROMPT}\n\n当前时间（本机，${SHANGHAI_TIME_ZONE}）：${formatShanghaiNow()}。`;
}

function buildInvokeMessages(
  history: AgentChatMessage[],
  userContent: string,
): ModelInvokeInput['messages'] {
  return [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: 'user', content: userContent },
  ];
}

/** DeepSeek 联网走 Anthropic API，成功时 raw.content 含 server_tool_use 块。 */
export function didUseWebSearch(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') {
    return false;
  }

  const content = (raw as { content?: Array<{ type?: string }> }).content;
  return Array.isArray(content) && content.some((block) => block.type === 'server_tool_use');
}

/** 响应为 OpenAI chat/completions 格式，说明未走 Anthropic 联网通道。 */
export function isOpenAiChatResponse(raw: unknown): boolean {
  return Boolean(raw && typeof raw === 'object' && 'choices' in (raw as object));
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
      params: AGENT_CHAT_ENABLE_WEB_SEARCH ? { enable_web_search: true } : undefined,
    });

    if (result.status === 'succeeded') {
      const textOutput = result.outputs.find((output) => output.type === 'text');
      const text =
        textOutput?.type === 'text'
          ? textOutput.text
          : JSON.stringify(result.outputs);
      const webSearchUsed = AGENT_CHAT_ENABLE_WEB_SEARCH && didUseWebSearch(result.raw);
      const offlineReply =
        AGENT_CHAT_ENABLE_WEB_SEARCH && isOpenAiChatResponse(result.raw);

      return {
        assistantMessage: {
          id: createAgentChatId('msg'),
          role: 'assistant',
          content: text,
          webSearchUsed,
          offlineReply,
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
