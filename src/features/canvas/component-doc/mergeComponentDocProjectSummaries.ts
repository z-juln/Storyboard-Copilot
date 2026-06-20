import type { ProjectSummary } from '@/features/project/types';

import { getComponentDocSnapshot } from './loadComponentDocProject';
import { COMPONENT_DOC_PROJECT_ID } from './constants';

export function getComponentDocProjectSummary(): ProjectSummary {
  const snapshot = getComponentDocSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    nodeCount: snapshot.nodeCount,
  };
}

export function mergeComponentDocProjectSummaries(projects: ProjectSummary[]): ProjectSummary[] {
  const withoutDoc = projects.filter((project) => project.id !== COMPONENT_DOC_PROJECT_ID);
  return [getComponentDocProjectSummary(), ...withoutDoc];
}
