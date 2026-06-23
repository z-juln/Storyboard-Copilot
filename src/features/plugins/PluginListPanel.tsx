import { ZImagePluginCard } from './ZImagePluginCard';
import { GitPluginCard } from './GitPluginCard';

export function PluginListPanel() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        插件扩展画布能力。展开条目可查看安装、服务状态与配置。
      </p>
      <GitPluginCard />
      <ZImagePluginCard />
    </div>
  );
}
