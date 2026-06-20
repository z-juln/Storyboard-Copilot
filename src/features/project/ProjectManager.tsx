import { useMemo, useState } from 'react';
import { Plus, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { getConfiguredApiKeyCount, useSettingsStore } from '@/stores/settingsStore';
import { UI_CONTENT_OVERLAY_INSET_CLASS } from '@/components/ui/motion';
import { UiButton, UiSelect } from '@/components/ui/primitives';
import { MissingApiKeyHint } from '@/features/settings/MissingApiKeyHint';
import { listModelProviders } from '@/features/canvas/models';
import { RenameDialog } from './RenameDialog';
import { isComponentDocProjectId } from '@/features/canvas/component-doc';

type ProjectSortField = 'name' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

export function ProjectManager() {
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
    <div className="ui-scrollbar h-full w-full overflow-auto p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-dark">项目管理</h1>
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
          </div>
          <UiButton type="button" variant="primary" onClick={handleCreateProject} className="gap-2">
            <Plus className="w-5 h-5" />
            新建项目
          </UiButton>
        </div>

        {configuredApiKeyCount === 0 && <MissingApiKeyHint className="mb-8" />}

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">暂无项目</p>
            <p className="text-sm mt-2">点击上方按钮创建新项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProjects.map((project) => {
              const isComponentDoc = isComponentDocProjectId(project.id);

              return (
              <div
                key={project.id}
                onClick={() => openProject(project.id)}
                className="bg-surface-dark border border-border-dark rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-text-dark truncate flex-1">
                    {project.name}
                  </h3>
                  {!isComponentDoc && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleRenameClick(project.id, project.name, e)}
                      className="p-1 hover:bg-bg-dark rounded"
                      title="重命名"
                    >
                      <Pencil className="w-4 h-4 text-text-muted hover:text-text-dark" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(project.id, e)}
                      className="p-1 hover:bg-bg-dark rounded"
                      title="删除项目"
                    >
                      <Trash2 className="w-4 h-4 text-text-muted hover:text-red-500" />
                    </button>
                  </div>
                  )}
                </div>
                <div className="text-xs text-text-muted">
                  {isComponentDoc ? (
                    <p>开发环境内置，节点组件说明与示例</p>
                  ) : (
                    <>
                      <p>
                        修改时间: {formatDate(project.updatedAt)}
                      </p>
                      <p>
                        创建时间: {formatDate(project.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {isOpeningProject && (
        <div className={`pointer-events-none fixed ${UI_CONTENT_OVERLAY_INSET_CLASS} bg-black/10`} />
      )}

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
