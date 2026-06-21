import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react';

import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import {
  resolveNodeAssetFileInputAccept,
  type NodeAssetFileKind,
} from '@/features/canvas/application/nodeAssetFileActions';

interface UseNodeAssetReplaceFileInputOptions {
  nodeId: string;
  assetKind: NodeAssetFileKind;
  imageUrl?: string | null;
  fileAssetId?: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
}

export function useNodeAssetReplaceFileInput({
  nodeId,
  assetKind,
  imageUrl,
  fileAssetId,
  onFileSelected,
}: UseNodeAssetReplaceFileInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onFileSelectedRef = useRef(onFileSelected);
  onFileSelectedRef.current = onFileSelected;

  const fileInputAccept = useMemo(
    () => resolveNodeAssetFileInputAccept({ assetKind, imageUrl, fileAssetId }),
    [assetKind, fileAssetId, imageUrl]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  useEffect(() => {
    return canvasEventBus.subscribe('node-asset/replace', ({ nodeId: targetNodeId }) => {
      if (targetNodeId !== nodeId) {
        return;
      }
      openFilePicker();
    });
  }, [nodeId, openFilePicker]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    void onFileSelectedRef.current(file);
  }, []);

  return {
    inputRef,
    fileInputAccept,
    openFilePicker,
    handleFileChange,
  };
}
