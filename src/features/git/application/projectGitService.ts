import { fetchAssetTextContent } from '@/features/project/asset/assetPreviewUtils';
import { rustApiClient } from '@/infrastructure/rustApiClient';
import { persistActiveProjectGraphFromCanvas } from '@/stores/projectStore';

import type {
  ProjectGitBlob,
  ProjectGitChange,
  ProjectGitCommit,
  ProjectGitStatus,
  ProjectGitStorage,
} from '../types';

export interface ProjectGitSnapshot {
  status: ProjectGitStatus;
  storage: ProjectGitStorage;
  changes: ProjectGitChange[];
  commits: ProjectGitCommit[];
}

export async function getProjectGitStatus(projectId: string): Promise<ProjectGitStatus> {
  return rustApiClient.getProjectGitStatus(projectId);
}

export async function initProjectGit(projectId: string): Promise<void> {
  await rustApiClient.initProjectGit(projectId);
}

export async function loadProjectGitStorage(projectId: string): Promise<ProjectGitStorage> {
  return rustApiClient.getProjectGitStorage(projectId);
}

export async function loadProjectGitSnapshot(projectId: string): Promise<ProjectGitSnapshot> {
  const status = await getProjectGitStatus(projectId);
  const [storage, changes, commits] = await Promise.all([
    loadProjectGitStorage(projectId),
    rustApiClient.listProjectGitChanges(projectId),
    status.commitCount > 0 || status.initialized
      ? rustApiClient.listProjectGitCommits(projectId)
      : Promise.resolve([] as ProjectGitCommit[]),
  ]);

  return { status, storage, changes, commits };
}

export async function commitProjectVersion(projectId: string, message: string): Promise<void> {
  persistActiveProjectGraphFromCanvas();
  await rustApiClient.commitProjectGit(projectId, message);
}

export async function keepCurrentProjectVersion(projectId: string): Promise<void> {
  await rustApiClient.keepCurrentProjectGitVersion(projectId);
}

export async function checkoutProjectVersion(projectId: string, commitHash: string): Promise<void> {
  await rustApiClient.checkoutProjectGitCommit(projectId, commitHash);
}

export async function revertProjectGitChange(
  projectId: string,
  change: Pick<ProjectGitChange, 'path' | 'kind' | 'oldPath'>,
): Promise<void> {
  await rustApiClient.revertProjectGitChange(
    projectId,
    change.path,
    change.kind,
    change.oldPath ?? null,
  );
}

export async function readGitCommittedBlob(
  projectId: string,
  commit: string,
  path: string,
): Promise<ProjectGitBlob> {
  return rustApiClient.readProjectGitBlob(projectId, commit, path);
}

export async function readGitChangeCurrentText(projectId: string, path: string): Promise<string> {
  if (path === 'project.json') {
    const snapshot = await rustApiClient.getProjectSnapshot(projectId);
    return snapshot ? JSON.stringify(snapshot, null, 2) : '（无法读取当前 project.json）';
  }
  if (path.startsWith('assets/')) {
    const content = await fetchAssetTextContent(projectId, path);
    return content ?? '（无法读取当前文件）';
  }
  return '（无法读取当前文件）';
}
