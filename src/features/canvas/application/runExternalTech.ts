import { getExternalTechProvider } from '@/features/canvas/external-tech/registry';
import type { ExternalTechRunInput, ExternalTechRunResult } from '@/features/canvas/external-tech/types';
import { rustApiClient } from '@/infrastructure/rustApiClient';

export async function runExternalTech(input: ExternalTechRunInput): Promise<ExternalTechRunResult> {
  const provider = getExternalTechProvider(input.providerId);
  if (!provider) {
    throw new Error(`未知的外部科技场景：${input.providerId}`);
  }

  const prompt = input.inputs.prompt?.trim() || input.prompt.trim();
  if (!prompt) {
    throw new Error('请输入提示词或连接文本节点');
  }

  if (provider.runner === 'local-zimage') {
    const result = await rustApiClient.runExternalTech({
      providerId: provider.id,
      prompt,
      projectId: input.projectId,
      inputs: input.inputs,
    });
    return { outputs: result.outputs };
  }

  throw new Error(`暂不支持的外部科技运行器：${provider.runner}`);
}
