import { useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

const AGENT_CHAT_MARKDOWN_CLASS =
  'markdown-body break-words [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold [&_hr]:my-2 [&_hr]:border-white/10 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0 [&_p+_p]:mt-2 [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-black/30 [&_pre]:p-2 [&_strong]:font-semibold [&_table]:my-1 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] [&_td]:border [&_td]:border-white/10 [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-white/10 [&_th]:px-1.5 [&_th]:py-0.5 [&_ul]:list-disc [&_ul]:pl-4';

interface AgentChatMarkdownProps {
  content: string;
}

export function AgentChatMarkdown({ content }: AgentChatMarkdownProps) {
  const handleLinkClick = useCallback((href?: string) => {
    if (!href) {
      return;
    }
    void openUrl(href);
  }, []);

  return (
    <div className={AGENT_CHAT_MARKDOWN_CLASS}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                event.preventDefault();
                handleLinkClick(href);
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
