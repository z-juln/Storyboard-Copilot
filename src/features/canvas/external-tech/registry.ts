import type { ExternalTechProviderDefinition } from './types';
import { zimageLocalProviderDefinition } from './providers/zimageLocal';

const providers: ExternalTechProviderDefinition[] = [zimageLocalProviderDefinition];

const providerMap = new Map(providers.map((item) => [item.id, item]));

export function listExternalTechProviders(): ExternalTechProviderDefinition[] {
  return providers;
}

export function getExternalTechProvider(providerId: string): ExternalTechProviderDefinition | null {
  return providerMap.get(providerId) ?? null;
}

export function getDefaultExternalTechProviderId(): string {
  return providers[0]?.id ?? '';
}
