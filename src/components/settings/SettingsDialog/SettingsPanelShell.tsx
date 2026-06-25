import type { ReactNode } from 'react';

interface SettingsPanelShellProps {
  title: string;
  description: string;
  onSave: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function SettingsPanelShell({
  title,
  description,
  onSave,
  children,
  footer,
}: SettingsPanelShellProps) {
  return (
    <>
      <div className="border-b border-border-dark px-6 py-5">
        <h2 className="text-lg font-semibold text-text-dark">{title}</h2>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>

      <div className="ui-scrollbar flex-1 space-y-4 overflow-y-auto p-6">
        {children}
      </div>

      <div className="flex justify-end border-t border-border-dark px-6 py-4">
        {footer ?? (
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80"
          >
            保存
          </button>
        )}
      </div>
    </>
  );
}
