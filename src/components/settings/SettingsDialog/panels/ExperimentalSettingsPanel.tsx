import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsCheckboxCard } from '../SettingsCheckboxCard';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface ExperimentalSettingsPanelProps {
  state: SettingsDialogState;
}

export function ExperimentalSettingsPanel({ state }: ExperimentalSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="实验"
      description="用于放置实验性质或低频使用的功能开关。"
      onSave={state.handleSave}
    >
      <SettingsCheckboxCard
        checked={state.localEnableStoryboardGenGridPreviewShortcut}
        onCheckedChange={state.setLocalEnableStoryboardGenGridPreviewShortcut}
        title="启用分镜网格预览快捷键"
        description="启用后，在分镜生成节点按住 Ctrl + Alt + Shift 点击“生成”会直接输出网格预览图，不发送 AI 请求。"
      />

      <SettingsCheckboxCard
        checked={state.localShowStoryboardGenAdvancedRatioControls}
        onCheckedChange={state.setLocalShowStoryboardGenAdvancedRatioControls}
        title="显示分镜比例高级控制"
        description="启用后显示单格/整体比例信息和“整体比/单格比”切换；关闭时默认按单格比逻辑运行。"
      />

      <SettingsCheckboxCard
        checked={state.localStoryboardGenAutoInferEmptyFrame}
        onCheckedChange={state.setLocalStoryboardGenAutoInferEmptyFrame}
        title="空分镜自动推测"
        description="启用后，分镜生成时如果某个格子没有填写内容，会自动追加“依据之前的内容进行推测”。"
      />
    </SettingsPanelShell>
  );
}
