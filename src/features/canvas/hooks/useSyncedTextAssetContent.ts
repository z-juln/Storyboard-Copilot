import { useCallback, useEffect, useRef, useState } from 'react';

import { canvasEventBus } from '@/features/canvas/application/canvasServices';
import {
  loadProjectAssetTextContent,
  saveProjectAssetTextContent,
} from '@/features/project/asset/textAssetContent';
import { normalizeAssetPath } from '@/features/project/asset';
import { useProjectStore } from '@/stores/projectStore';

const SAVE_DEBOUNCE_MS = 600;

interface UseSyncedTextAssetContentInput {
  projectId: string | null;
  assetPath: string | null;
  initialContent: string;
  initialSyncedAt?: number | null;
  /** 为 false 时不自动写盘（例如预览对话框仅在点击保存时写入） */
  autoSave?: boolean;
  onContentSaved?: (content: string, updatedAt: number) => void;
}

export function useSyncedTextAssetContent(input: UseSyncedTextAssetContentInput) {
  const commitAssetManifest = useProjectStore((state) => state.commitAssetManifest);
  const assetManifest = useProjectStore((state) => state.currentProject?.assetManifest);
  const {
    projectId,
    assetPath,
    initialContent,
    initialSyncedAt,
    autoSave = false,
    onContentSaved,
  } = input;

  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const contentRef = useRef(content);
  const isDirtyRef = useRef(false);
  const lastSavedAtRef = useRef(initialSyncedAt ?? 0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedPath = assetPath ? normalizeAssetPath(assetPath) : null;

  contentRef.current = content;
  isDirtyRef.current = isDirty;

  useEffect(() => {
    setContent(initialContent);
    setIsDirty(false);
    isDirtyRef.current = false;
    lastSavedAtRef.current = initialSyncedAt ?? 0;
  }, [initialContent, initialSyncedAt, normalizedPath]);

  const persistContent = useCallback(async (nextContent: string) => {
    if (!projectId || !normalizedPath || !assetManifest) {
      return null;
    }

    setIsSaving(true);
    try {
      const result = await saveProjectAssetTextContent({
        projectId,
        path: normalizedPath,
        content: nextContent,
        manifest: assetManifest,
      });
      commitAssetManifest(result.manifest);
      lastSavedAtRef.current = result.updatedAt;
      setIsDirty(false);
      isDirtyRef.current = false;
      canvasEventBus.publish('text-asset/updated', {
        path: normalizedPath,
        updatedAt: result.updatedAt,
      });
      onContentSaved?.(nextContent, result.updatedAt);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [assetManifest, commitAssetManifest, normalizedPath, projectId, onContentSaved]);

  const scheduleAutoSave = useCallback((nextContent: string) => {
    if (!autoSave) {
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistContent(nextContent);
    }, SAVE_DEBOUNCE_MS);
  }, [autoSave, persistContent]);

  const updateContent = useCallback((nextContent: string) => {
    setContent(nextContent);
    setIsDirty(true);
    isDirtyRef.current = true;
    scheduleAutoSave(nextContent);
  }, [scheduleAutoSave]);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    return persistContent(contentRef.current);
  }, [persistContent]);

  useEffect(() => {
    if (!normalizedPath) {
      return;
    }

    return canvasEventBus.subscribe('text-asset/updated', async ({ path, updatedAt }) => {
      if (normalizeAssetPath(path) !== normalizedPath) {
        return;
      }
      if (isDirtyRef.current && updatedAt <= lastSavedAtRef.current) {
        return;
      }

      if (!projectId) {
        return;
      }

      const remoteContent = await loadProjectAssetTextContent(projectId, normalizedPath);
      if (remoteContent === null) {
        return;
      }

      lastSavedAtRef.current = updatedAt;
      setContent(remoteContent);
      setIsDirty(false);
      isDirtyRef.current = false;
      onContentSaved?.(remoteContent, updatedAt);
    });
  }, [normalizedPath, onContentSaved, projectId]);

  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
  }, []);

  return {
    content,
    isDirty,
    isSaving,
    updateContent,
    saveNow,
    setContent,
    setIsDirty,
  };
}
