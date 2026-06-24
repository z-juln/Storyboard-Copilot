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
        {message.content}
      </div>
    </div>
  );
}
