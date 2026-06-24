import { Sparkles } from 'lucide-react';

import { AGENT_CHAT_SYSTEM_PROMPT } from '@/features/canvas/agentChat';

export function AgentChatSystemPromptBanner() {
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/5 px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-accent uppercase">
        <Sparkles className="h-3 w-3" />
        系统提示词
      </div>
      <p className="text-xs leading-relaxed text-text-muted">{AGENT_CHAT_SYSTEM_PROMPT}</p>
    </div>
  );
}
