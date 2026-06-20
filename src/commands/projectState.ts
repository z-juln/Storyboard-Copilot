import { rustApiClient } from '@/infrastructure/rustApiClient';
import type { ProjectSnapshot } from '@/features/project/types';
import type { Viewport } from '@xyflow/react';

export interface ProjectSummaryRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}

export type { ProjectSnapshot };

export async function listProjectSummaries(): Promise<ProjectSummaryRecord[]> {
  return rustApiClient.listProjectSummaries();
}

export async function getProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  return rustApiClient.getProjectSnapshot(projectId);
}

export async function upsertProjectSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  await rustApiClient.upsertProjectSnapshot(snapshot);
}

export async function updateProjectViewportRecord(
  projectId: string,
  viewport: Viewport
): Promise<void> {
  await rustApiClient.updateProjectViewportRecord(projectId, viewport);
}

export async function renameProjectRecord(
  projectId: string,
  name: string,
  updatedAt: number
): Promise<void> {
  await rustApiClient.renameProjectRecord(projectId, name, updatedAt);
}

export async function deleteProjectRecord(projectId: string): Promise<void> {
  await rustApiClient.deleteProjectRecord(projectId);
}
