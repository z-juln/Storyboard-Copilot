import { createAgentChatId } from './id';
import type {
  AgentChatConversation,
  AgentChatHistoryGroup,
  AgentChatMessage,
} from './types';

export function createConversationId(): string {
  return createAgentChatId('conv');
}

export function createEmptyConversation(): AgentChatConversation {
  const now = Date.now();
  return {
    id: createConversationId(),
    title: '未命名对话',
    messages: [],
    updatedAt: now,
    createdAt: now,
  };
}

export function deriveConversationTitle(messages: AgentChatMessage[]): string {
  const firstUser = messages.find((message) => message.role === 'user');
  if (!firstUser) {
    return '未命名对话';
  }

  const trimmed = firstUser.content.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return '未命名对话';
  }

  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}

export function upsertConversation(
  conversations: AgentChatConversation[],
  conversation: AgentChatConversation,
): AgentChatConversation[] {
  const index = conversations.findIndex((item) => item.id === conversation.id);
  if (index === -1) {
    return [conversation, ...conversations];
  }

  const next = [...conversations];
  next[index] = conversation;
  return next.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function listPersistedConversations(
  conversations: AgentChatConversation[],
): AgentChatConversation[] {
  return conversations
    .filter((conversation) => conversation.messages.length > 0)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function groupConversationsByRecency(
  conversations: AgentChatConversation[],
): AgentChatHistoryGroup[] {
  const now = Date.now();
  const dayMs = 86_400_000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const sevenDaysAgo = now - 7 * dayMs;

  const today: AgentChatConversation[] = [];
  const withinSevenDays: AgentChatConversation[] = [];
  const earlier: AgentChatConversation[] = [];

  for (const conversation of listPersistedConversations(conversations)) {
    if (conversation.updatedAt >= todayStart) {
      today.push(conversation);
      continue;
    }
    if (conversation.updatedAt >= sevenDaysAgo) {
      withinSevenDays.push(conversation);
      continue;
    }
    earlier.push(conversation);
  }

  return [
    { label: '今天', items: today },
    { label: '7天内', items: withinSevenDays },
    { label: '更早', items: earlier },
  ].filter((group) => group.items.length > 0);
}

export function buildConversationFromMessages(
  conversationId: string,
  messages: AgentChatMessage[],
  existing?: AgentChatConversation,
): AgentChatConversation {
  const now = Date.now();
  return {
    id: conversationId,
    title: deriveConversationTitle(messages),
    messages,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
  };
}

export function resolveActiveMessages(
  activeConversationId: string,
  conversations: AgentChatConversation[],
): AgentChatMessage[] {
  return conversations.find((conversation) => conversation.id === activeConversationId)?.messages ?? [];
}
