import {
  memo,
  useEffect,
  useRef,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

import {
  NODE_FORM_FIELD_CLASS,
  useNodeFieldEditMode,
} from '@/features/canvas/hooks/useNodeFieldEditMode';

interface NodeEditableTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  selected?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  previewClassName?: string;
  renderPreview?: (value: string) => ReactNode;
  emptyPreview?: ReactNode;
  onEnterEditing?: () => void;
  disabled?: boolean;
}

export const NodeEditableTextarea = memo(({
  selected = false,
  value,
  onValueChange,
  className = '',
  previewClassName = '',
  renderPreview,
  emptyPreview,
  placeholder,
  onBlur,
  onKeyDown,
  onEnterEditing,
  disabled = false,
  ...textareaProps
}: NodeEditableTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isEditing,
    exitEditing,
    bindPreview,
    bindField,
  } = useNodeFieldEditMode(selected, onEnterEditing);

  useEffect(() => {
    if (isEditing && !disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled, isEditing]);

  if (isEditing && !disabled) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          exitEditing();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            exitEditing();
            return;
          }
          onKeyDown?.(event);
        }}
        className={`${NODE_FORM_FIELD_CLASS} ${className}`.trim()}
        {...bindField()}
        {...textareaProps}
      />
    );
  }

  return (
    <div
      className={`nowheel h-full w-full overflow-auto ${previewClassName}`.trim()}
      {...bindPreview()}
    >
      {value.trim().length > 0 ? (
        renderPreview ? renderPreview(value) : (
          <pre className="whitespace-pre-wrap break-words font-sans">{value}</pre>
        )
      ) : (
        emptyPreview ?? (
          <div className="pt-1 text-text-muted">{placeholder ?? '双击编辑'}</div>
        )
      )}
    </div>
  );
});

NodeEditableTextarea.displayName = 'NodeEditableTextarea';
