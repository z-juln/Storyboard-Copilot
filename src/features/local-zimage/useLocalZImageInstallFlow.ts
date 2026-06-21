import { useCallback, useEffect, useMemo, useState } from 'react';

import type { LocalZImageStatus } from '@/features/canvas/external-tech/types';
import {
  type LocalZImageInstallStepDefinition,
  type LocalZImageInstallStepId,
} from '@/features/local-zimage/installFlow';
import { listVisibleInstallSteps } from '@/features/local-zimage/installFlowPresentation';
import { rustApiClient } from '@/infrastructure/rustApiClient';

async function waitUntilStepIdle(
  readStatus: () => Promise<LocalZImageStatus>,
  onTick?: (status: LocalZImageStatus) => void
): Promise<LocalZImageStatus> {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const status = await readStatus();
    onTick?.(status);
    if (!status.install_running) {
      if (status.install_error) {
        throw new Error(status.install_error);
      }
      return status;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error('安装步骤超时，请查看日志后重试');
}

export function useLocalZImageInstallFlow() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<LocalZImageStatus | null>(null);
  const [busyStepId, setBusyStepId] = useState<LocalZImageInstallStepId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stopServerConfirm, setStopServerConfirm] = useState<{ activeCount: number } | null>(null);

  const refreshStatus = useCallback(async () => {
    const next = await rustApiClient.getLocalZImageStatus();
    setStatus(next);
    setError(next.install_error);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    rustApiClient
      .health()
      .then(() => {
        if (!cancelled) {
          setApiOnline(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiOnline(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiOnline) {
      return undefined;
    }
    void refreshStatus().catch(() => undefined);
    const intervalMs = status?.model_loading ? 1000 : 2000;
    const timer = window.setInterval(() => {
      void refreshStatus().catch(() => undefined);
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [apiOnline, refreshStatus, status?.model_loading]);

  const recommendedStep = useMemo(() => {
    if (!status) {
      return listVisibleInstallSteps(null)[0] ?? null;
    }
    if (!status.installed) {
      const nextId = status.next_recommended_step as LocalZImageInstallStepId | null;
      const visible = listVisibleInstallSteps(status);
      return visible.find((item) => item.id === nextId)
        ?? visible.find((item) => item.apiStep === nextId)
        ?? visible[0]
        ?? null;
    }
    if (!status.server_running) {
      return listVisibleInstallSteps(status).find((item) => item.id === 'start-server') ?? null;
    }
    return null;
  }, [status]);

  const runStep = useCallback(async (step: LocalZImageInstallStepDefinition) => {
    setBusyStepId(step.id);
    setError(null);
    setSuccessMessage(null);
    try {
      if (step.id === 'start-server') {
        const next = await rustApiClient.startLocalZImageServer();
        setStatus(next);
        if (next.install_error) {
          throw new Error(next.install_error);
        }
        if (next.server_running) {
          setSuccessMessage(`本地 Z-Image 服务已启动：${next.server_url}`);
        } else {
          throw new Error('服务启动后未检测到运行状态，请查看安装日志');
        }
        return next;
      }

      if (!step.apiStep) {
        throw new Error('该步骤缺少 API 定义');
      }

      await rustApiClient.runLocalZImageInstallStep(step.apiStep);
      const next = await waitUntilStepIdle(refreshStatus, setStatus);
      return next;
    } catch (stepError) {
      const message = stepError instanceof Error ? stepError.message : '步骤执行失败';
      setError(message);
      throw stepError;
    } finally {
      setBusyStepId(null);
    }
  }, [refreshStatus]);

  const executeStopServer = useCallback(async (force: boolean) => {
    setBusyStepId('start-server');
    try {
      const next = await rustApiClient.stopLocalZImageServer({ force });
      setStatus(next);
      setStopServerConfirm(null);
      return next;
    } finally {
      setBusyStepId(null);
    }
  }, []);

  const stopServer = useCallback(async () => {
    const activeJobs = await rustApiClient.getLocalZImageActiveJobs().catch(() => ({ count: 0 }));
    if (activeJobs.count > 0) {
      setStopServerConfirm({ activeCount: activeJobs.count });
      return null;
    }
    return executeStopServer(false);
  }, [executeStopServer]);

  const cancelStopServer = useCallback(() => {
    setStopServerConfirm(null);
  }, []);

  const confirmStopServer = useCallback(async () => {
    if (!stopServerConfirm) {
      return null;
    }
    return executeStopServer(true);
  }, [executeStopServer, stopServerConfirm]);

  const warmupModel = useCallback(async () => {
    setBusyStepId('start-server');
    setError(null);
    try {
      const next = await rustApiClient.warmupLocalZImageModel();
      setStatus(next);
      return next;
    } catch (warmupError) {
      const message = warmupError instanceof Error ? warmupError.message : '模型预加载失败';
      setError(message);
      throw warmupError;
    } finally {
      setBusyStepId(null);
    }
  }, []);

  return {
    apiOnline,
    status,
    busyStepId,
    error,
    successMessage,
    recommendedStep,
    refreshStatus,
    runStep,
    stopServer,
    cancelStopServer,
    confirmStopServer,
    stopServerConfirm,
    warmupModel,
  };
}
