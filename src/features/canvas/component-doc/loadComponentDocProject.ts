import type { ProjectSnapshot } from '@/features/project/types';
import componentDocSnapshot from './project.json';
import {
  COMPONENT_DOC_PROJECT_ID,
  COMPONENT_DOC_PROJECT_NAME,
} from './constants';
import { snapshotToProject, type Project } from '@/features/project';

/** 从仓库内 project.json 加载 component-doc（与正式项目同结构） */
export function loadComponentDocProject(): Project {
  const project = snapshotToProject({
    ...(componentDocSnapshot as ProjectSnapshot),
    id: COMPONENT_DOC_PROJECT_ID,
    name: COMPONENT_DOC_PROJECT_NAME,
  });
  return project;
}

export function getComponentDocSnapshot(): ProjectSnapshot {
  return {
    ...(componentDocSnapshot as ProjectSnapshot),
    id: COMPONENT_DOC_PROJECT_ID,
    name: COMPONENT_DOC_PROJECT_NAME,
  };
}
