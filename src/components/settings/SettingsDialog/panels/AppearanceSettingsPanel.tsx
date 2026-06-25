import { UiSelect } from '@/components/ui';

import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface AppearanceSettingsPanelProps {
  state: SettingsDialogState;
}

export function AppearanceSettingsPanel({ state }: AppearanceSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="外观"
      description="自定义应用外观"
      onSave={state.handleSave}
    >
      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">圆角大小</h3>
        <p className="mt-1 text-xs text-text-muted">
          控制面板、输入框与节点的全局圆角风格。
        </p>
        <div className="mt-3">
          <UiSelect
            value={state.localUiRadiusPreset}
            onChange={(event) =>
              state.setLocalUiRadiusPreset(event.target.value as typeof state.localUiRadiusPreset)
            }
            className="h-9 text-sm"
          >
            <option value="compact">紧凑</option>
            <option value="default">默认</option>
            <option value="large">圆润</option>
          </UiSelect>
        </div>
      </div>

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">明暗色调</h3>
        <p className="mt-1 text-xs text-text-muted">
          为深浅主题选择中性、暖色或冷色倾向。
        </p>
        <div className="mt-3">
          <UiSelect
            value={state.localThemeTonePreset}
            onChange={(event) =>
              state.setLocalThemeTonePreset(event.target.value as typeof state.localThemeTonePreset)
            }
            className="h-9 text-sm"
          >
            <option value="neutral">中性</option>
            <option value="warm">暖色</option>
            <option value="cool">冷色</option>
          </UiSelect>
        </div>
      </div>

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">连线样式</h3>
        <p className="mt-1 text-xs text-text-muted">
          切换节点间连线路径风格，可选择自动避让节点的直角走线。
        </p>
        <div className="mt-3">
          <UiSelect
            value={state.localCanvasEdgeRoutingMode}
            onChange={(event) =>
              state.setLocalCanvasEdgeRoutingMode(
                event.target.value as typeof state.localCanvasEdgeRoutingMode
              )
            }
            className="h-9 text-sm"
          >
            <option value="spline">曲线</option>
            <option value="orthogonal">直角</option>
            <option value="smartOrthogonal">智能避让（直角）</option>
          </UiSelect>
        </div>
      </div>

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">强调色</h3>
        <p className="mt-1 text-xs text-text-muted">
          用于按钮、选中边框和交互高亮。
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={state.localAccentColor}
            onChange={(event) => state.setLocalAccentColor(event.target.value)}
            className="h-9 w-12 rounded border border-border-dark bg-surface-dark p-1"
          />
          <input
            value={state.localAccentColor}
            onChange={(event) => state.setLocalAccentColor(event.target.value)}
            placeholder="#3B82F6"
            className="h-9 flex-1 rounded border border-border-dark bg-surface-dark px-3 text-sm text-text-dark outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded border border-border-dark bg-surface-dark px-3 text-xs text-text-dark transition-colors hover:bg-bg-dark"
            onClick={() => state.setLocalAccentColor('#3B82F6')}
          >
            恢复默认
          </button>
        </div>
      </div>
    </SettingsPanelShell>
  );
}
