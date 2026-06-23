import { memo, type KeyboardEvent } from 'react';
import { Check } from 'lucide-react';

import { UiButton, UiInput } from '@/components/ui/primitives';

interface GitCommitFormProps {
  message: string;
  readOnly: boolean;
  busy: boolean;
  onMessageChange: (value: string) => void;
  onCommit: () => void;
}

export const GitCommitForm = memo(({
  message,
  readOnly,
  busy,
  onMessageChange,
  onCommit,
}: GitCommitFormProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || ((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
      event.preventDefault();
      if (!readOnly && !busy) {
        onCommit();
      }
    }
  };

  if (readOnly) {
    return null;
  }

  return (
    <div className="space-y-2">
      <UiInput
        value={message}
        disabled={busy}
        placeholder="消息 (↩ 提交)"
        className="h-8 px-2.5 text-xs"
        onChange={(event) => onMessageChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <UiButton
        type="button"
        variant="primary"
        size="sm"
        className="h-8 w-full"
        disabled={busy}
        onClick={onCommit}
      >
        <Check className="mr-1.5 h-3.5 w-3.5" />
        提交
      </UiButton>
    </div>
  );
});

GitCommitForm.displayName = 'GitCommitForm';
