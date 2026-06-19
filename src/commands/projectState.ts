import { rustApiClient } from '@/infrastructure/rustApiClient';

export interface ProjectSummaryRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
}

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  nodeCount: number;
  nodesJson: string;
  edgesJson: string;
  viewportJson: string;
  historyJson: string;
}

export async function listProjectSummaries(): Promise<ProjectSummaryRecord[]> {
  return rustApiClient.listProjectSummaries();
}

export async function getProjectRecord(projectId: string): Promise<ProjectRecord | null> {
  return rustApiClient.getProjectRecord(projectId);
}

export async function upsertProjectRecord(record: ProjectRecord): Promise<void> {
  await rustApiClient.upsertProjectRecord(record);
}

export async function updateProjectViewportRecord(
  projectId: string,
  viewportJson: string
): Promise<void> {
  await rustApiClient.updateProjectViewportRecord(projectId, viewportJson);
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
