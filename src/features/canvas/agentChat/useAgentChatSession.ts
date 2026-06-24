import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildConversationFromMessages,
  createEmptyConversation,
  groupConversationsByRecency,
  resolveActiveMessages,
  upsertConversation,
} from './conversationDomain';
import { loadAgentChatSession, saveAgentChatSession } from './conversationStore';
import type { AgentChatConversation, AgentChatMessage } from './types';

export function useAgentChatSession(projectId: string | null) {
  const [activeConversationId, setActiveConversationId] = useState('');
  const [conversations, setConversations] = useState<AgentChatConversation[]>([]);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    if (!projectId) {
      const draft = createEmptyConversation();
      setActiveConversationId(draft.id);
      setConversations([]);
      setMessages([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void loadAgentChatSession(projectId)
      .then((session) => {
        if (cancelled) {
          return;
        }
        setActiveConversationId(session.activeConversationId);
        setConversations(session.conversations);
        setMessages(resolveActiveMessages(session.activeConversationId, session.conversations));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const persistSnapshot = useCallback(
    (conversationId: string, nextConversations: AgentChatConversation[]) => {
      if (!projectId) {
        return;
      }

      void saveAgentChatSession(projectId, {
        activeConversationId: conversationId,
        conversations: nextConversations,
      }).catch(() => undefined);
    },
    [projectId],
  );

  const commitMessages = useCallback(
    (conversationId: string, nextMessages: AgentChatMessage[]) => {
      setMessages(nextMessages);

      if (nextMessages.length === 0) {
        persistSnapshot(conversationId, conversationsRef.current);
        return;
      }

      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === conversationId);
        const nextConversation = buildConversationFromMessages(
          conversationId,
          nextMessages,
          existing,
        );
        const next = upsertConversation(current, nextConversation);
        persistSnapshot(conversationId, next);
        return next;
      });
    },
    [persistSnapshot],
  );

  const startNewConversation = useCallback(() => {
    const nextConversation = createEmptyConversation();
    setActiveConversationId(nextConversation.id);
    setMessages([]);
    persistSnapshot(nextConversation.id, conversationsRef.current);
  }, [persistSnapshot]);

  const selectConversation = useCallback(
    (conversationId: string) => {
      const selected = conversationsRef.current.find(
        (conversation) => conversation.id === conversationId,
      );
      if (!selected) {
        return;
      }

      setActiveConversationId(conversationId);
      setMessages(selected.messages);
      persistSnapshot(conversationId, conversationsRef.current);
    },
    [persistSnapshot],
  );

  const historyGroups = useMemo(
    () => groupConversationsByRecency(conversations),
    [conversations],
  );

  return {
    activeConversationId,
    messages,
    commitMessages,
    historyGroups,
    isLoading,
    startNewConversation,
    selectConversation,
  };
}
