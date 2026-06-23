import { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkoutProjectVersion,
  commitProjectVersion,
  getProjectGitStatus,
  initProjectGit,
  keepCurrentProjectVersion,
  loadProjectGitSnapshot,
  loadProjectGitStorage,
  revertProjectGitChange,
} from '@/features/git/application/projectGitService';
import type {
  ProjectGitChange,
  ProjectGitCommit,
  ProjectGitStatus,
  ProjectGitStorage,
} from '@/features/git/types';

const STORAGE_POLL_MS = 30_000;

interface UseProjectGitControllerOptions {
  projectId: string;
  enabled: boolean;
}

export function useProjectGitController({
  projectId,
  enabled,
}: UseProjectGitControllerOptions) {
  const [status, setStatus] = useState<ProjectGitStatus | null>(null);
  const [storage, setStorage] = useState<ProjectGitStorage | null>(null);
  const [changes, setChanges] = useState<ProjectGitChange[]>([]);
  const [commits, setCommits] = useState<ProjectGitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissStorageWarning, setDismissStorageWarning] = useState(false);
  const initAttemptedRef = useRef(false);

  const refreshAll = useCallback(async (options?: { force?: boolean }) => {
    if (!enabled && !options?.force) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let nextStatus = await getProjectGitStatus(projectId);
      if (!nextStatus.initialized && !initAttemptedRef.current) {
        initAttemptedRef.current = true;
        await initProjectGit(projectId);
        nextStatus = await getProjectGitStatus(projectId);
      }

      const snapshot = await loadProjectGitSnapshot(projectId);
      setStatus(snapshot.status);
      setStorage(snapshot.storage);
      setChanges(snapshot.changes);
      setCommits(snapshot.commits);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '加载版本信息失败');
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    initAttemptedRef.current = false;
    void refreshAll();

    const timer = window.setInterval(() => {
      void loadProjectGitStorage(projectId)
        .then(setStorage)
        .catch(() => undefined);
    }, STORAGE_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, projectId, refreshAll]);

  const commit = useCallback(async (message: string) => {
    await commitProjectVersion(projectId, message);
    await refreshAll();
  }, [projectId, refreshAll]);

  const keepCurrentVersion = useCallback(async () => {
    await keepCurrentProjectVersion(projectId);
    await refreshAll();
  }, [projectId, refreshAll]);

  const checkout = useCallback(async (commitHash: string) => {
    await checkoutProjectVersion(projectId, commitHash);
    await refreshAll();
  }, [projectId, refreshAll]);

  const revertChange = useCallback(async (change: ProjectGitChange) => {
    await revertProjectGitChange(projectId, change);
    await refreshAll();
  }, [projectId, refreshAll]);

  return {
    status,
    storage,
    changes,
    commits,
    loading,
    error,
    dismissStorageWarning,
    setDismissStorageWarning,
    refreshAll,
    commit,
    keepCurrentVersion,
    checkout,
    revertChange,
  };
}
