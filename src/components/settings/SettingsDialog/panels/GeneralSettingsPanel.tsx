import { FolderOpen, Plus, Trash2 } from 'lucide-react';

import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsCheckboxCard } from '../SettingsCheckboxCard';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface GeneralSettingsPanelProps {
  state: SettingsDialogState;
}

export function GeneralSettingsPanel({ state }: GeneralSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="通用"
      description="通用设置"
      onSave={state.handleSave}
    >
      <SettingsCheckboxCard
        checked={state.localStoryboardGenKeepStyleConsistent}
        onCheckedChange={state.setLocalStoryboardGenKeepStyleConsistent}
        title="分镜图风格与参考图保持一致"
        description="启用后，分镜生成提示词会追加“图片风格与参考图保持一致”。"
      />

      <SettingsCheckboxCard
        checked={state.localIgnoreAtTagWhenCopyingAndGenerating}
        onCheckedChange={state.setLocalIgnoreAtTagWhenCopyingAndGenerating}
        title="复制/保存文本时忽略 @ 标签"
        description="启用后，复制文本和写入图片分镜元数据时会忽略类似“@图1”的标签；发送生成请求时仅移除“@”并保留“图1”。"
      />

      <SettingsCheckboxCard
        checked={state.localStoryboardGenDisableTextInImage}
        onCheckedChange={state.setLocalStoryboardGenDisableTextInImage}
        title="分镜图禁止生成描述文本"
        description="启用后，分镜生成提示词会追加“禁止添加描述文本”。"
      />

      <SettingsCheckboxCard
        checked={state.localUseUploadFilenameAsNodeTitle}
        onCheckedChange={state.setLocalUseUploadFilenameAsNodeTitle}
        title="上传节点自动使用文件名作为标题"
        description="启用后，新上传图片会默认使用文件名作为节点标题（仍可双击手动重命名）。"
      />

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-text-dark">下载预设路径</h3>
          <p className="mt-1 text-xs text-text-muted">
            用于节点工具条下载菜单中的快速保存目录（最多 8 个）
          </p>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <input
            value={state.localDownloadPathInput}
            onChange={(event) => state.setLocalDownloadPathInput(event.target.value)}
            placeholder="输入目录路径，例如 /Users/name/Pictures/Storyboard 或 D:\\Images\\Storyboard"
            className="h-9 flex-1 rounded border border-border-dark bg-surface-dark px-3 text-sm text-text-dark outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded border border-border-dark bg-surface-dark px-3 text-xs text-text-dark transition-colors hover:bg-bg-dark"
            onClick={state.handleAddDownloadPathFromInput}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            添加路径
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded border border-border-dark bg-surface-dark px-3 text-xs text-text-dark transition-colors hover:bg-bg-dark"
            onClick={() => {
              void state.handlePickDownloadPath();
            }}
          >
            <FolderOpen className="mr-1 h-3.5 w-3.5" />
            选择文件夹
          </button>
        </div>

        <div className="space-y-1">
          {state.localDownloadPresetPaths.length > 0 ? (
            state.localDownloadPresetPaths.map((path) => (
              <div
                key={path}
                className="flex items-center gap-2 rounded border border-border-dark bg-surface-dark px-2 py-1.5"
              >
                <span className="truncate text-xs text-text-dark">{path}</span>
                <button
                  type="button"
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-dark hover:text-text-dark"
                  onClick={() => state.handleRemoveDownloadPath(path)}
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-xs text-text-muted">暂无预设路径</div>
          )}
        </div>
      </div>
    </SettingsPanelShell>
  );
}
