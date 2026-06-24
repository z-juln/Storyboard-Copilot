import { rustApiClient } from '@/infrastructure/rustApiClient';

import {
  createEmptyConversation,
  listPersistedConversations,
} from './conversationDomain';
import type { AgentChatSessionSnapshot } from './types';

const LEGACY_STORAGE_PREFIX = 'storyboard-copilot:agent-chat:';

function legacyStorageKey(projectId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${projectId}`;
}

function loadLegacyLocalStorageSession(projectId: string): AgentChatSessionSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(legacyStorageKey(projectId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      activeConversationId?: string;
      conversations?: AgentChatSessionSnapshot['conversations'];
    };

    if (!parsed.activeConversationId) {
      return null;
    }

    return {
      activeConversationId: parsed.activeConversationId,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    return null;
  }
}

function clearLegacyLocalStorageSession(projectId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(legacyStorageKey(projectId));
}

function createDefaultSession(): AgentChatSessionSnapshot {
  const conversation = createEmptyConversation();
  return {
    activeConversationId: conversation.id,
    conversations: [],
  };
}

function normalizeLoadedSession(snapshot: AgentChatSessionSnapshot): AgentChatSessionSnapshot {
  if (!snapshot.activeConversationId) {
    return createDefaultSession();
  }

  return {
    activeConversationId: snapshot.activeConversationId,
    conversations: Array.isArray(snapshot.conversations) ? snapshot.conversations : [],
  };
}

function hasPersistedConversations(snapshot: AgentChatSessionSnapshot): boolean {
  return snapshot.conversations.some((conversation) => conversation.messages.length > 0);
}

export async function loadAgentChatSession(projectId: string): Promise<AgentChatSessionSnapshot> {
  try {
    const snapshot = normalizeLoadedSession(await rustApiClient.getProjectChatHistory(projectId));
    if (hasPersistedConversations(snapshot) || snapshot.activeConversationId) {
      return snapshot;
    }
  } catch {
    // fall through to legacy migration / default session
  }

  const legacy = loadLegacyLocalStorageSession(projectId);
  if (legacy && hasPersistedConversations(legacy)) {
    try {
      await saveAgentChatSession(projectId, legacy);
      clearLegacyLocalStorageSession(projectId);
    } catch {
      // keep legacy in memory if migration write fails
    }
    return normalizeLoadedSession(legacy);
  }

  return createDefaultSession();
}

export async function saveAgentChatSession(
  projectId: string,
  snapshot: AgentChatSessionSnapshot,
): Promise<void> {
  await rustApiClient.saveProjectChatHistory(projectId, {
    activeConversationId: snapshot.activeConversationId,
    conversations: listPersistedConversations(snapshot.conversations),
  });
}
