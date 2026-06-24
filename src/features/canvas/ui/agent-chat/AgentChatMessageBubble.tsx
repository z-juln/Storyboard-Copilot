import type { AgentChatMessage } from '@/features/canvas/agentChat';

export function AgentChatMessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-accent/20 text-text-dark'
            : 'bg-bg-dark/80 text-text-dark'
        }`}
      >
        {!isUser && message.offlineReply ? (
          <div className="mb-1.5 text-[10px] font-medium text-amber-400/90">
            未走联网通道（请重启应用以加载最新后端）
          </div>
        ) : null}
        {!isUser && message.webSearchUsed ? (
          <div className="mb-1.5 text-[10px] font-medium text-emerald-400/90">已联网搜索</div>
        ) : null}
        {message.content}
      </div>
    </div>
  );
}
