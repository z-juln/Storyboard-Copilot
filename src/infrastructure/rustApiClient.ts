import type { Viewport } from '@xyflow/react';

import type {
  BuiltinAdapterSummary,
  ModelCallResult,
  ModelInvokeInput,
  ProviderSecretStatus,
} from '@/features/aiModels/types';
import type { ProjectSnapshot } from '@/features/project/types';
import type { ProjectSummaryRecord } from '@/commands/projectState';

const DEFAULT_BASE_URL = 'http://127.0.0.1:1421';
const DEFAULT_UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024;

export function resolveRustApiBaseUrl(): string {
  const configured = import.meta.env.VITE_RUST_API_BASE_URL?.trim();
  return (configured || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function resolveBaseUrl(): string {
  return resolveRustApiBaseUrl();
}

export function buildLocalImageUrl(filePath: string): string {
  return `${resolveRustApiBaseUrl()}/image?path=${encodeURIComponent(filePath)}`;
}

export interface PrepareNodeImageResult {
  imagePath: string;
  previewImagePath: string;
  aspectRatio: string;
}

export interface MergeStoryboardImagesPayload {
  frameSources: string[];
  rows: number;
  cols: number;
  cellGap: number;
  outerPadding: number;
  noteHeight: number;
  fontSize: number;
  backgroundColor: string;
  maxDimension: number;
  showFrameIndex?: boolean;
  showFrameNote?: boolean;
  notePlacement?: 'overlay' | 'bottom';
  imageFit?: 'cover' | 'contain';
  frameIndexPrefix?: string;
  textColor?: string;
  frameNotes?: string[];
}

export interface MergeStoryboardImagesResult {
  imagePath: string;
  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;
  gap: number;
  padding: number;
  noteHeight: number;
  fontSize: number;
  textOverlayApplied: boolean;
}

export interface StoryboardImageMetadata {
  gridRows: number;
  gridCols: number;
  frameNotes: string[];
}

interface CreateImageUploadSessionResult {
  uploadId: string;
  chunkSize: number;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function readEmpty(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  throw new Error(payload.error || `HTTP ${response.status}`);
}

async function abortImageUploadSession(
  baseUrl: string,
  projectId: string,
  uploadId: string
): Promise<void> {
  await fetch(
    `${baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/images/upload-sessions/${uploadId}`,
    {
      method: 'DELETE',
    }
  ).catch(() => undefined);
}

async function uploadBinaryInChunks(
  baseUrl: string,
  projectId: string,
  data: Blob,
  extension: string,
  maxPreviewDimension?: number
): Promise<PrepareNodeImageResult> {
  const sessionResponse = await fetch(
    `${baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/images/upload-sessions`,
    {
      method: 'POST',
    }
  );
  const session = await readJson<CreateImageUploadSessionResult>(sessionResponse);
  const chunkSize = session.chunkSize > 0 ? session.chunkSize : DEFAULT_UPLOAD_CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.ceil(data.size / chunkSize));

  try {
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const start = chunkIndex * chunkSize;
      const chunk = data.slice(start, start + chunkSize);
      const chunkResponse = await fetch(
        `${baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/images/upload-sessions/${session.uploadId}/chunks/${chunkIndex}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: chunk,
        }
      );
      await readEmpty(chunkResponse);
    }

    const completeResponse = await fetch(
      `${baseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/images/upload-sessions/${session.uploadId}/complete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extension,
          totalChunks,
          maxPreviewDimension,
        }),
      }
    );
    return readJson<PrepareNodeImageResult>(completeResponse);
  } catch (error) {
    await abortImageUploadSession(baseUrl, projectId, session.uploadId);
    throw error;
  }
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
  listProjectSummaries: () => Promise<ProjectSummaryRecord[]>;
  getProjectSnapshot: (projectId: string) => Promise<ProjectSnapshot | null>;
  upsertProjectSnapshot: (snapshot: ProjectSnapshot) => Promise<void>;
  updateProjectViewportRecord: (projectId: string, viewport: Viewport) => Promise<void>;
  renameProjectRecord: (projectId: string, name: string, updatedAt: number) => Promise<void>;
  deleteProjectRecord: (projectId: string) => Promise<void>;
  putProjectAsset: (projectId: string, fileName: string, data: Blob) => Promise<string>;
  prepareNodeImageFromBlob: (
    projectId: string,
    data: Blob,
    extension: string,
    maxPreviewDimension?: number
  ) => Promise<PrepareNodeImageResult>;
  prepareNodeImageFromSource: (
    projectId: string,
    source: string,
    maxPreviewDimension?: number
  ) => Promise<PrepareNodeImageResult>;
  mergeStoryboardImages: (
    projectId: string,
    payload: MergeStoryboardImagesPayload
  ) => Promise<MergeStoryboardImagesResult>;
  embedStoryboardImageMetadata: (
    projectId: string,
    source: string,
    metadata: StoryboardImageMetadata
  ) => Promise<string>;
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
    listProjectSummaries: async () => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects`);
      const payload = await readJson<{ projects: ProjectSummaryRecord[] }>(response);
      return payload.projects;
    },
    getProjectSnapshot: async (projectId) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects/${projectId}`);
      if (response.status === 404) {
        return null;
      }
      return readJson<ProjectSnapshot>(response);
    },
    upsertProjectSnapshot: async (snapshot) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects/${snapshot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
      await readEmpty(response);
    },
    updateProjectViewportRecord: async (projectId, viewport) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects/${projectId}/viewport`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewport }),
      });
      await readEmpty(response);
    },
    renameProjectRecord: async (projectId, name, updatedAt) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects/${projectId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, updatedAt }),
      });
      await readEmpty(response);
    },
    deleteProjectRecord: async (projectId) => {
      const response = await fetch(`${normalizedBaseUrl}/api/v1/projects/${projectId}`, {
        method: 'DELETE',
      });
      await readEmpty(response);
    },
    putProjectAsset: async (projectId, fileName, data) => {
      const response = await fetch(
        `${normalizedBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(fileName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: data,
        }
      );
      const payload = await readJson<{ path: string }>(response);
      return payload.path;
    },
    prepareNodeImageFromBlob: async (projectId, data, extension, maxPreviewDimension) =>
      uploadBinaryInChunks(normalizedBaseUrl, projectId, data, extension, maxPreviewDimension),
    prepareNodeImageFromSource: async (projectId, source, maxPreviewDimension) => {
      const response = await fetch(
        `${normalizedBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/images/prepare-from-source`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source,
            maxPreviewDimension,
          }),
        }
      );
      return readJson<PrepareNodeImageResult>(response);
    },
    mergeStoryboardImages: async (projectId, payload) => {
      const response = await fetch(
        `${normalizedBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/storyboard/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      return readJson<MergeStoryboardImagesResult>(response);
    },
    embedStoryboardImageMetadata: async (projectId, source, metadata) => {
      const response = await fetch(
        `${normalizedBaseUrl}/api/v1/projects/${encodeURIComponent(projectId)}/storyboard/embed-metadata`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, metadata }),
        }
      );
      const result = await readJson<{ path: string }>(response);
      return result.path;
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
