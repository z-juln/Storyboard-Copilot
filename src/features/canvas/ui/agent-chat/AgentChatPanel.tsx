import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { History, Loader2, Plus, Send, X } from 'lucide-react';

import { UiButton, UiIconButton, UiPanel, UiTextArea } from '@/components/ui';
import {
  AGENT_CHAT_MODEL_LABEL,
  createUserMessage,
  invokeAgentChatReply,
  useAgentChatSession,
} from '@/features/canvas/agentChat';
import { AgentChatHistoryMenu } from '@/features/canvas/ui/agent-chat/AgentChatHistoryMenu';
import { AgentChatMessageBubble } from '@/features/canvas/ui/agent-chat/AgentChatMessageBubble';
import { AgentChatSystemPromptBanner } from '@/features/canvas/ui/agent-chat/AgentChatSystemPromptBanner';

interface AgentChatPanelProps {
  projectId: string | null;
  offsetForAssetManager: boolean;
  onClose: () => void;
}

export const AgentChatPanel = memo(({
  projectId,
  offsetForAssetManager,
  onClose,
}: AgentChatPanelProps) => {
  const {
    activeConversationId,
    messages,
    commitMessages,
    historyGroups,
    isLoading,
    startNewConversation,
    selectConversation,
  } = useAgentChatSession(projectId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const historyButtonRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages, isSending]);

  const handleSend = useCallback(async () => {
    const content = draftRef.current.trim();
    if (!content || isSending) {
      return;
    }

    setDraft('');
    setError(null);
    setIsSending(true);

    const userMessage = createUserMessage(content);
    const pendingHistory = [...messages, userMessage];
    commitMessages(activeConversationId, pendingHistory);

    const result = await invokeAgentChatReply(messages, content);
    setIsSending(false);

    if ('error' in result) {
      setError(result.error);
      return;
    }

    commitMessages(activeConversationId, [...pendingHistory, result.assistantMessage]);
  }, [activeConversationId, commitMessages, isSending, messages]);

  const handleDraftKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }
      event.preventDefault();
      void handleSend();
    },
    [handleSend],
  );

  return (
    <div
      className={`pointer-events-none absolute top-[4.75rem] z-20 w-[min(22rem,calc(100vw-2rem))] ${
        offsetForAssetManager
          ? 'left-[calc(1rem+min(22rem,calc(100vw-2rem))+0.5rem)]'
          : 'left-4'
      }`}
    >
      <UiPanel className="pointer-events-auto flex max-h-[min(36rem,calc(100vh-8rem))] flex-col overflow-hidden rounded-xl shadow-xl">
        <div className="flex items-center justify-between border-b border-border-dark px-3 py-2">
          <div>
            <div className="text-sm font-medium text-text-dark">Agent 对话</div>
            <div className="text-[11px] text-text-muted">
              内置 {AGENT_CHAT_MODEL_LABEL} · Enter 发送 · Shift+Enter 换行
            </div>
          </div>
          <div className="flex items-center gap-1">
            <UiIconButton
              className="h-7 w-7"
              title="新对话"
              disabled={isSending}
              onClick={() => {
                setDraft('');
                setError(null);
                setHistoryOpen(false);
                startNewConversation();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </UiIconButton>
            <div ref={historyButtonRef} className="group/history relative">
              <UiIconButton
                className={`h-7 w-7 ${historyOpen ? 'border-accent/45 bg-accent/15 text-accent' : ''}`}
                disabled={isSending}
                onClick={() => setHistoryOpen((value) => !value)}
              >
                <History className="h-3.5 w-3.5" />
              </UiIconButton>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-[calc(100%+0.375rem)] z-[130] -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1a1a1a] px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover/history:opacity-100 group-focus-within/history:opacity-100"
              >
                对话历史
              </span>
            </div>
            <UiIconButton className="h-7 w-7" title="关闭" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </UiIconButton>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          <AgentChatSystemPromptBanner />
          {isLoading ? (
            <div className="flex items-center gap-2 px-1 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载对话历史…
            </div>
          ) : messages.length === 0 ? (
            <div className="px-1 text-xs leading-relaxed text-text-muted">
              向 Agent 提问分镜、角色或场景相关问题。默认使用内置 DeepSeek，无需配置 API Key。
            </div>
          ) : (
            messages.map((message) => (
              <AgentChatMessageBubble key={message.id} message={message} />
            ))
          )}
          {isSending ? (
            <div className="flex items-center gap-2 px-1 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              思考中…
            </div>
          ) : null}
        </div>

        <div className="border-t border-border-dark px-3 py-2">
          {error ? (
            <p className="mb-2 text-xs text-red-400">{error}</p>
          ) : null}
          <div className="flex items-end gap-2">
            <UiTextArea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              rows={2}
              placeholder="输入消息…"
              className="min-h-[3.25rem] flex-1 resize-none text-xs"
              disabled={isSending || isLoading}
            />
            <UiButton
              variant="primary"
              size="sm"
              className="h-8 shrink-0 px-2.5"
              disabled={!draft.trim() || isSending || isLoading}
              onClick={() => void handleSend()}
              title="发送"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </UiButton>
          </div>
        </div>
      </UiPanel>

      <AgentChatHistoryMenu
        open={historyOpen}
        anchorRef={historyButtonRef}
        groups={historyGroups}
        activeConversationId={activeConversationId}
        onSelect={(conversationId) => {
          setDraft('');
          setError(null);
          selectConversation(conversationId);
        }}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
});

AgentChatPanel.displayName = 'AgentChatPanel';
