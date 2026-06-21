import { LocalZImageInstallFlowPanel } from '@/features/local-zimage/LocalZImageInstallFlowPanel';
import { isLocalZImageFullyReady } from '@/features/local-zimage/LocalZImageModelLoadBanner';
import { useLocalZImageInstallFlow } from '@/features/local-zimage/useLocalZImageInstallFlow';

import { CollapsiblePluginCard, type PluginStatusVariant } from './CollapsiblePluginCard';

function resolveZImageStatus(status: ReturnType<typeof useLocalZImageInstallFlow>['status']): {
  label: string;
  variant: PluginStatusVariant;
  defaultExpanded: boolean;
} {
  if (!status) {
    return { label: '加载中', variant: 'idle', defaultExpanded: true };
  }
  if (isLocalZImageFullyReady(status)) {
    return { label: '已就绪', variant: 'ready', defaultExpanded: false };
  }
  if (status.model_loading) {
    return { label: '模型加载中', variant: 'warning', defaultExpanded: true };
  }
  if (status.install_running) {
    return { label: '安装中', variant: 'warning', defaultExpanded: true };
  }
  if (status.server_running && !status.model_loaded) {
    return { label: '待加载模型', variant: 'warning', defaultExpanded: true };
  }
  if (status.needs_setup) {
    return { label: '待配置', variant: 'warning', defaultExpanded: true };
  }
  return { label: '未就绪', variant: 'idle', defaultExpanded: true };
}

export function ZImagePluginCard() {
  const { status } = useLocalZImageInstallFlow();
  const pluginStatus = resolveZImageStatus(status);

  return (
    <CollapsiblePluginCard
      title="外部科技 · 本地 Z-Image"
      description="在本机运行 Z-Image Turbo，供外部科技节点调用。"
      statusLabel={pluginStatus.label}
      statusVariant={pluginStatus.variant}
      defaultExpanded={pluginStatus.defaultExpanded}
    >
      <LocalZImageInstallFlowPanel compact />
    </CollapsiblePluginCard>
  );
}
