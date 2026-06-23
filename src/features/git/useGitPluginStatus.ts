import { useEffect, useState } from 'react';

import type { GitPluginStatus } from '@/features/git/types';
import { rustApiClient } from '@/infrastructure/rustApiClient';

type StatusListener = () => void;

let cachedStatus: GitPluginStatus | null = null;
let subscriberCount = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<StatusListener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

async function refreshStatus() {
  try {
    await rustApiClient.health();
    cachedStatus = await rustApiClient.getGitPluginStatus();
  } catch {
    cachedStatus = null;
  }
  notifyListeners();
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  void refreshStatus();
  pollTimer = window.setInterval(() => {
    void refreshStatus();
  }, 5000);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function subscribe(listener: StatusListener): () => void {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) {
    startPolling();
  }

  return () => {
    listeners.delete(listener);
    subscriberCount -= 1;
    if (subscriberCount === 0) {
      stopPolling();
    }
  };
}

export function useGitPluginStatus(enabled: boolean): GitPluginStatus | null {
  const [status, setStatus] = useState<GitPluginStatus | null>(enabled ? cachedStatus : null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    setStatus(cachedStatus);
    return subscribe(() => {
      setStatus(cachedStatus);
    });
  }, [enabled]);

  return enabled ? status : null;
}
