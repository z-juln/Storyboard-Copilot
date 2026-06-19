import type {
  BuiltinAdapterSummary,
  ModelCallResult,
  ModelInvokeInput,
  ProviderSecretStatus,
} from '@/features/aiModels/types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:1421';

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_RUST_API_BASE_URL?.trim();
  return configured || DEFAULT_BASE_URL;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

export interface RustApiClient {
  health: () => Promise<{ status: string; version: string }>;
  listAdapters: () => Promise<BuiltinAdapterSummary[]>;
  invokeAdapter: (input: {
    adapterId: string;
    input: ModelInvokeInput;
    params?: Record<string, unknown>;
  }) => Promise<ModelCallResult>;
  pollAdapter: (input: {
    adapterId: string;
    task: NonNullable<Extract<ModelCallResult, { status: 'queued' | 'running' }>>['task'];
  }) => Promise<ModelCallResult>;
  getSecretStatus: (providerId: string) => Promise<ProviderSecretStatus>;
  setProviderSecret: (providerId: string, apiKey: string) => Promise<ProviderSecretStatus>;
}

export function createRustApiClient(baseUrl = resolveBaseUrl()): RustApiClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return {
    health: async () => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/health`);
      return readJson(response);
    },
    listAdapters: async () => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/adapters`);
      const payload = await readJson<{ adapters: BuiltinAdapterSummary[] }>(response);
      return payload.adapters;
    },
    invokeAdapter: async ({ adapterId, input, params }) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/adapters/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId, input, params }),
      });
      return readJson<ModelCallResult>(response);
    },
    pollAdapter: async ({ adapterId, task }) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/adapters/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapterId, task }),
      });
      return readJson<ModelCallResult>(response);
    },
    getSecretStatus: async (providerId) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/secrets/${providerId}`);
      return readJson<ProviderSecretStatus>(response);
    },
    setProviderSecret: async (providerId, apiKey) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/secrets/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      return readJson<ProviderSecretStatus>(response);
    },
  };
}

export const rustApiClient = createRustApiClient();

export async function pollAdapterUntilDone(options: {
  adapterId: string;
  task: Extract<ModelCallResult, { status: 'queued' | 'running' }>['task'];
  client?: RustApiClient;
  maxAttempts?: number;
}): Promise<ModelCallResult> {
  const client = options.client ?? rustApiClient;
  const maxAttempts = options.maxAttempts ?? 120;
  let task = options.task;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (task.pollAfterMs) {
      await new Promise((resolve) => setTimeout(resolve, task.pollAfterMs));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const result = await client.pollAdapter({
      adapterId: options.adapterId,
      task,
    });

    if (result.status === 'succeeded' || result.status === 'failed') {
      return result;
    }

    if (result.status === 'queued' || result.status === 'running') {
      task = result.task;
    }
  }

  return {
    status: 'failed',
    error: '轮询超时',
  };
}
