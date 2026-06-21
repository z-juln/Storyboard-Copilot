import { ZIMAGE_LOCAL_PROVIDER_ID } from '@/features/canvas/external-tech/providers/zimageLocal';
import { canvasAiGateway } from '@/features/canvas/application/canvasServices';
import type { GenerationJobStatus } from '@/commands/ai';
import type { LocalZImageJobStatus } from '@/infrastructure/rustApiClient';
import { rustApiClient } from '@/infrastructure/rustApiClient';

export interface ResolvedGenerationJobPoll {
  status: GenerationJobStatus;
  isZImageJob: boolean;
}

function toGenerationJobStatus(status: LocalZImageJobStatus): GenerationJobStatus {
  return {
    job_id: status.job_id,
    status: status.status as GenerationJobStatus['status'],
    result: status.result ?? null,
    error: status.error ?? null,
  };
}

export async function pollGenerationJobStatus(
  jobId: string,
  generationProviderId: string
): Promise<ResolvedGenerationJobPoll | null> {
  const trimmedJobId = jobId.trim();
  if (!trimmedJobId) {
    return null;
  }

  if (generationProviderId === ZIMAGE_LOCAL_PROVIDER_ID) {
    const status = await rustApiClient.getLocalZImageJob(trimmedJobId).catch(() => null);
    return status ? { status: toGenerationJobStatus(status), isZImageJob: true } : null;
  }

  if (!generationProviderId) {
    const zimageStatus = await rustApiClient.getLocalZImageJob(trimmedJobId).catch(() => null);
    if (zimageStatus && zimageStatus.status !== 'not_found') {
      return { status: toGenerationJobStatus(zimageStatus), isZImageJob: true };
    }
  }

  const status = await canvasAiGateway.getGenerateImageJob(trimmedJobId).catch(() => null);
  return status ? { status, isZImageJob: false } : null;
}
