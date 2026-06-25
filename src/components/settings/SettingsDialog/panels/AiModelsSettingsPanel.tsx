import { BuiltinModelsPanel } from '@/components/settings/BuiltinModelsPanel';
import { LocalZImagePanel } from '@/components/settings/LocalZImagePanel';

export function AiModelsSettingsPanel() {
  return (
    <div className="ui-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
      <LocalZImagePanel />
      <BuiltinModelsPanel />
    </div>
  );
}
