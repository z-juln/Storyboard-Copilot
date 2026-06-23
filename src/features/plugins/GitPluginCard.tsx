import { CollapsiblePluginCard, type PluginStatusVariant } from './CollapsiblePluginCard';
import { useGitPluginStatus } from '@/features/git/useGitPluginStatus';

function resolveGitPluginStatus(status: ReturnType<typeof useGitPluginStatus>): {
  label: string;
  variant: PluginStatusVariant;
  defaultExpanded: boolean;
} {
  if (!status) {
    return { label: '检测中', variant: 'idle', defaultExpanded: true };
  }
  if (status.available) {
    return {
      label: status.version ? `已就绪 · ${status.version}` : '已就绪',
      variant: 'ready',
      defaultExpanded: false,
    };
  }
  return { label: '待安装 Git', variant: 'warning', defaultExpanded: true };
}

export function GitPluginCard() {
  const status = useGitPluginStatus(true);
  const pluginStatus = resolveGitPluginStatus(status);

  return (
    <CollapsiblePluginCard
      title="版本控制 · Git"
      description="在项目目录使用 Git 管理 project.json 与 assets 的版本历史。"
      statusLabel={pluginStatus.label}
      statusVariant={pluginStatus.variant}
      defaultExpanded={pluginStatus.defaultExpanded}
    >
      {status?.available ? (
        <p className="text-xs leading-5 text-text-muted">
          系统已检测到 Git。打开项目后，在资产管理面板的「版本」Tab 中提交与管理历史版本。
        </p>
      ) : (
        <div className="space-y-2 text-xs leading-5 text-text-muted">
          <p>{status?.installHint ?? '正在检测 Git…'}</p>
          <p>安装完成后无需额外配置，刷新本页或重新打开插件列表即可。</p>
        </div>
      )}
    </CollapsiblePluginCard>
  );
}
