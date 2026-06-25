import { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { openUrl } from '@tauri-apps/plugin-opener';

import providerGuideMarkdown from '../../../../docs/settings/provider-guide.md?raw';

interface ProviderGuidePopoverProps {
  visible: boolean;
}

export function ProviderGuidePopover({ visible }: ProviderGuidePopoverProps) {
  const handleMarkdownLinkClick = useCallback((href?: string) => {
    if (!href) {
      return;
    }
    void openUrl(href);
  }, []);

  return (
    <div
      className={`absolute bottom-0 left-[calc(50%+366px)] right-0 top-0 min-w-[240px] max-w-[380px] rounded-lg border border-border-dark bg-surface-dark/95 p-3 shadow-xl transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="markdown-body break-words text-xs leading-5 text-text-muted [&_a]:text-accent [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold [&_hr]:border-white/10 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0 [&_p+_p]:mt-4 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-black/30 [&_pre]:p-2 [&_ul]:list-disc [&_ul]:pl-4">
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
                  handleMarkdownLinkClick(href);
                }}
              >
                {children}
              </a>
            ),
          }}
        >
          {providerGuideMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
