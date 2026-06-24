import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

import { UI_POPOVER_TRANSITION_MS } from '@/components/ui/motion';
import type { AgentChatHistoryGroup } from '@/features/canvas/agentChat';

interface AgentChatHistoryMenuProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  groups: AgentChatHistoryGroup[];
  activeConversationId: string;
  onSelect: (conversationId: string) => void;
  onClose: () => void;
}

export const AgentChatHistoryMenu = memo(({
  open,
  anchorRef,
  groups,
  activeConversationId,
  onSelect,
  onClose,
}: AgentChatHistoryMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 280 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const width = 280;
    const left = Math.min(rect.right - width, window.innerWidth - width - 8);
    setPosition({
      left: Math.max(8, left),
      top: rect.bottom + 6,
      width,
    });
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      setIsVisible(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className={`fixed z-[120] overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-2xl transition-opacity ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        transitionDuration: `${UI_POPOVER_TRANSITION_MS}ms`,
      }}
    >
      <div className="border-b border-border-dark px-3 py-2 text-xs font-medium text-text-dark">
        对话历史
      </div>
      <div className="ui-scrollbar max-h-[min(20rem,calc(100vh-10rem))] overflow-y-auto py-1">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs leading-relaxed text-text-muted">
            暂无对话历史
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.label}>
              <div className="px-3 py-1.5 text-[11px] text-text-muted">{group.label}</div>
              {group.items.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-bg-dark/70 ${
                      isActive ? 'bg-accent/10' : ''
                    }`}
                    onClick={() => {
                      onSelect(conversation.id);
                      onClose();
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-dark/80 text-text-muted">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-xs ${
                          isActive ? 'font-medium text-accent' : 'text-text-dark'
                        }`}
                      >
                        {conversation.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
});

AgentChatHistoryMenu.displayName = 'AgentChatHistoryMenu';
