export const COMPONENT_DOC_PROJECT_ID = 'component-doc';

export const COMPONENT_DOC_PROJECT_NAME = 'Component Doc';

export function isComponentDocProjectId(projectId: string | null | undefined): boolean {
  return projectId === COMPONENT_DOC_PROJECT_ID;
}

/** 仅开发环境注入并展示 component-doc 项目 */
export function isComponentDocEnabled(): boolean {
  return import.meta.env.DEV;
}
