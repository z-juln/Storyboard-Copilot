import type { SettingsCategory } from '@/features/settings/settingsEvents';

import { SETTINGS_NAV_ITEMS } from './constants';

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
}: SettingsSidebarProps) {
  return (
    <div className="flex w-[180px] flex-col border-r border-border-dark bg-bg-dark">
      <div className="px-4 py-4">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          设置
        </span>
      </div>

      <nav className="flex-1">
        {SETTINGS_NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onCategoryChange(item.id)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              activeCategory === item.id
                ? 'border-l-2 border-accent bg-accent/10 text-text-dark'
                : 'text-text-muted hover:bg-bg-dark hover:text-text-dark'
            }`}
          >
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
