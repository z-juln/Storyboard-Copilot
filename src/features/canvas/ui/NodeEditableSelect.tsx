import {
  memo,
  useEffect,
  useRef,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import {
  NODE_FORM_FIELD_CLASS,
  useNodeFieldEditMode,
} from '@/features/canvas/hooks/useNodeFieldEditMode';

export interface NodeEditableSelectOption {
  value: string;
  label: string;
}

interface NodeEditableSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'children'> {
  selected?: boolean;
  value: string;
  options: NodeEditableSelectOption[];
  onValueChange: (value: string) => void;
  previewClassName?: string;
  renderPreview?: (option: NodeEditableSelectOption | null) => ReactNode;
  onEnterEditing?: () => void;
}

export const NodeEditableSelect = memo(({
  selected = false,
  value,
  options,
  onValueChange,
  className = '',
  previewClassName = '',
  renderPreview,
  disabled,
  onBlur,
  onEnterEditing,
  ...selectProps
}: NodeEditableSelectProps) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const {
    isEditing,
    exitEditing,
    bindPreview,
    bindField,
  } = useNodeFieldEditMode(selected, onEnterEditing);

  const activeOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (isEditing) {
      selectRef.current?.focus();
    }
  }, [isEditing]);

  if (isEditing && !disabled) {
    return (
      <select
        ref={selectRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          exitEditing();
          onBlur?.(event);
        }}
        className={`${NODE_FORM_FIELD_CLASS} ${className}`.trim()}
        {...bindField()}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className={`truncate ${previewClassName || className}`.trim()}
      {...bindPreview()}
    >
      {renderPreview
        ? renderPreview(activeOption)
        : (activeOption?.label ?? value)}
    </div>
  );
});

NodeEditableSelect.displayName = 'NodeEditableSelect';
