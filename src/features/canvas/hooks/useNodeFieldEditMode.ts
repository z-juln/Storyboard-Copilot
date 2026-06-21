import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export const NODE_FORM_FIELD_CLASS = 'nodrag nowheel';

export function stopNodeDragPropagation(event: {
  stopPropagation: () => void;
}) {
  event.stopPropagation();
}

export function useNodeFieldEditMode(
  selected: boolean,
  onEnterEditing?: () => void,
) {
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!selected) {
      setIsEditing(false);
    }
  }, [selected]);

  const enterEditing = useCallback((event?: ReactMouseEvent) => {
    event?.stopPropagation();
    onEnterEditing?.();
    setIsEditing(true);
  }, [onEnterEditing]);

  const exitEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const bindPreview = useCallback(() => ({
    onDoubleClick: enterEditing,
    title: '双击编辑',
  }), [enterEditing]);

  const bindField = useCallback(() => ({
    onPointerDown: stopNodeDragPropagation,
    onMouseDown: stopNodeDragPropagation,
  }), []);

  return {
    isEditing,
    enterEditing,
    exitEditing,
    bindPreview,
    bindField,
  };
}

export function useNodeFieldsEditMode(
  selected: boolean,
  onEnterEditing?: () => void,
) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setActiveFieldId(null);
    }
  }, [selected]);

  const isEditing = useCallback(
    (fieldId: string) => activeFieldId === fieldId,
    [activeFieldId],
  );

  const enterEditing = useCallback((fieldId: string, event?: ReactMouseEvent) => {
    event?.stopPropagation();
    onEnterEditing?.();
    setActiveFieldId(fieldId);
  }, [onEnterEditing]);

  const exitEditing = useCallback(() => {
    setActiveFieldId(null);
  }, []);

  const bindPreview = useCallback((fieldId: string) => ({
    onDoubleClick: (event: ReactMouseEvent) => enterEditing(fieldId, event),
    title: '双击编辑',
  }), [enterEditing]);

  const bindField = useCallback(() => ({
    onPointerDown: (event: ReactPointerEvent) => stopNodeDragPropagation(event),
    onMouseDown: (event: ReactMouseEvent) => stopNodeDragPropagation(event),
  }), []);

  return {
    activeFieldId,
    isEditing,
    enterEditing,
    exitEditing,
    bindPreview,
    bindField,
  };
}
