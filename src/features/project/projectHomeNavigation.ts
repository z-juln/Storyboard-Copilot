import { useProjectStore, type ProjectHomeTab } from '@/stores/projectStore';

export type { ProjectHomeTab };

export function navigateToProjectHomeTab(tab: ProjectHomeTab): void {
  const store = useProjectStore.getState();
  store.setProjectHomeTab(tab);
  store.closeProject();
}
