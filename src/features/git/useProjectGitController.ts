import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ProjectGitChange,
  ProjectGitCommit,
  ProjectGitStatus,
  ProjectGitStorage,
} from '@/features/git/types';
import { persistActiveProjectGraphFromCanvas } from '@/stores/projectStore';
import { rustApiClient } from '@/infrastructure/rustApiClient';

const STORAGE_POLL_MS = 30_000;

interface UseProjectGitControllerOptions {
  projectId: string;
  enabled: boolean;
  readOnly?: boolean;
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
      let nextStatus = await rustApiClient.getProjectGitStatus(projectId);
      if (!nextStatus.initialized && !initAttemptedRef.current) {
        initAttemptedRef.current = true;
        await rustApiClient.initProjectGit(projectId);
        nextStatus = await rustApiClient.getProjectGitStatus(projectId);
      }

      const [nextStorage, nextChanges, nextCommits] = await Promise.all([
        rustApiClient.getProjectGitStorage(projectId),
        rustApiClient.listProjectGitChanges(projectId).catch(() => [] as ProjectGitChange[]),
        nextStatus.commitCount > 0 || nextStatus.initialized
          ? rustApiClient.listProjectGitCommits(projectId).catch(() => [] as ProjectGitCommit[])
          : Promise.resolve([] as ProjectGitCommit[]),
      ]);

      setStatus(nextStatus);
      setStorage(nextStorage);
      setChanges(nextChanges);
      setCommits(nextCommits);
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
      void rustApiClient.getProjectGitStorage(projectId)
        .then(setStorage)
        .catch(() => undefined);
    }, STORAGE_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, projectId, refreshAll]);

  const commit = useCallback(async (message: string) => {
    persistActiveProjectGraphFromCanvas();
    await rustApiClient.commitProjectGit(projectId, message);
    await refreshAll();
  }, [projectId, refreshAll]);

  const keepCurrentVersion = useCallback(async () => {
    await rustApiClient.keepCurrentProjectGitVersion(projectId);
    await refreshAll();
  }, [projectId, refreshAll]);

  const checkout = useCallback(async (commitHash: string) => {
    await rustApiClient.checkoutProjectGitCommit(projectId, commitHash);
    await refreshAll();
  }, [projectId, refreshAll]);

  const revertChange = useCallback(async (path: string, kind: string) => {
    await rustApiClient.revertProjectGitChange(projectId, path, kind);
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
