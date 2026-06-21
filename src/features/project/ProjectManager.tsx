import { useMemo, useState } from 'react';
import { Plus, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { getConfiguredApiKeyCount, useSettingsStore } from '@/stores/settingsStore';
import { UI_CONTENT_OVERLAY_INSET_CLASS } from '@/components/ui/motion';
import { UiButton, UiSelect } from '@/components/ui/primitives';
import { MissingApiKeyHint } from '@/features/settings/MissingApiKeyHint';
import { PluginListPanel } from '@/features/plugins/PluginListPanel';
import { listModelProviders } from '@/features/canvas/models';
import { RenameDialog } from './RenameDialog';
import { isComponentDocProjectId } from '@/features/canvas/component-doc';

type ProjectSortField = 'name' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export function ProjectManager() {
  const activeTab = useProjectStore((state) => state.projectHomeTab);
  const setProjectHomeTab = useProjectStore((state) => state.setProjectHomeTab);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [sortField, setSortField] = useState<ProjectSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const providerIds = useMemo(() => listModelProviders().map((provider) => provider.id), []);
  const configuredApiKeyCount = useSettingsStore((state) =>
    getConfiguredApiKeyCount(state.apiKeys, providerIds)
  );

  const { projects, isOpeningProject, createProject, deleteProject, renameProject, openProject } =
    useProjectStore();

  const handleCreateProject = () => {
    setEditingProjectId(null);
    setEditingProjectName('');
    setShowRenameDialog(true);
  };

  const handleRenameClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(id);
    setEditingProjectName(name);
    setShowRenameDialog(true);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteProject(id);
  };

  const handleConfirm = (name: string) => {
    if (editingProjectId) {
      renameProject(editingProjectId, name);
    } else {
      createProject(name);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  const sortedProjects = useMemo(() => {
    const list = [...projects];
    const direction = sortDirection === 'asc' ? 1 : -1;

    list.sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base' }) * direction;
      }

      const left = sortField === 'createdAt' ? a.createdAt : a.updatedAt;
      const right = sortField === 'createdAt' ? b.createdAt : b.updatedAt;
      return (left - right) * direction;
    });

    return list;
  }, [projects, sortDirection, sortField]);

  return (
    <div className="ui-scrollbar h-full min-h-0 w-full overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-dark">项目管理</h1>
          <div className="mt-4 flex gap-1 border-b border-border-dark">
            <button
              type="button"
              className={`border-b-2 px-4 py-2 text-sm transition-colors ${
                activeTab === 'projects'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-dark'
              }`}
              onClick={() => setProjectHomeTab('projects')}
            >
              项目列表
            </button>
            <button
              type="button"
              className={`border-b-2 px-4 py-2 text-sm transition-colors ${
                activeTab === 'plugins'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-dark'
              }`}
              onClick={() => setProjectHomeTab('plugins')}
            >
              插件列表
            </button>
          </div>
        </div>

        {activeTab === 'projects' ? (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UiSelect
                  aria-label="排序字段"
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as ProjectSortField)}
                  className="h-9 w-[100px] rounded-lg text-sm"
                >
                  <option value="name">按名称</option>
                  <option value="createdAt">按创建日期</option>
                  <option value="updatedAt">按修改日期</option>
                </UiSelect>
                <UiSelect
                  aria-label="排序顺序"
                  value={sortDirection}
                  onChange={(event) => setSortDirection(event.target.value as SortDirection)}
                  className="h-9 w-[60px] rounded-lg text-sm"
                >
                  <option value="asc">升序</option>
                  <option value="desc">降序</option>
                </UiSelect>
              </div>
              <UiButton type="button" variant="primary" onClick={handleCreateProject} className="gap-2">
                <Plus className="h-5 w-5" />
                新建项目
              </UiButton>
            </div>

            {configuredApiKeyCount === 0 ? <MissingApiKeyHint className="mb-8" /> : null}

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                <FolderOpen className="mb-4 h-16 w-16 opacity-50" />
                <p className="text-lg">暂无项目</p>
                <p className="mt-2 text-sm">点击上方按钮创建新项目</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProjects.map((project) => {
                  const isComponentDoc = isComponentDocProjectId(project.id);

                  return (
                    <div
                      key={project.id}
                      onClick={() => openProject(project.id)}
                      className="group cursor-pointer rounded-lg border border-border-dark bg-surface-dark p-4 transition-all hover:border-primary/50 hover:shadow-lg"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <h3 className="flex-1 truncate font-semibold text-text-dark">
                          {project.name}
                        </h3>
                        {!isComponentDoc ? (
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => handleRenameClick(project.id, project.name, e)}
                              className="rounded p-1 hover:bg-bg-dark"
                              title="重命名"
                            >
                              <Pencil className="h-4 w-4 text-text-muted hover:text-text-dark" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(project.id, e)}
                              className="rounded p-1 hover:bg-bg-dark"
                              title="删除项目"
                            >
                              <Trash2 className="h-4 w-4 text-text-muted hover:text-red-500" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-xs text-text-muted">
                        {isComponentDoc ? (
                          <p>开发环境内置，节点组件说明与示例</p>
                        ) : (
                          <>
                            <p>修改时间: {formatDate(project.updatedAt)}</p>
                            <p>创建时间: {formatDate(project.createdAt)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <PluginListPanel />
        )}
      </div>

      {isOpeningProject ? (
        <div className={`pointer-events-none fixed ${UI_CONTENT_OVERLAY_INSET_CLASS} bg-black/10`} />
      ) : null}

      <RenameDialog
        isOpen={showRenameDialog}
        title={editingProjectId ? '重命名项目' : '新建项目'}
        defaultValue={editingProjectName}
        onClose={() => setShowRenameDialog(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
