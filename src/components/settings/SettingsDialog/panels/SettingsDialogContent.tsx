import type { SettingsDialogState } from '../useSettingsDialogState';
import { AboutSettingsPanel } from './AboutSettingsPanel';
import { AiModelsSettingsPanel } from './AiModelsSettingsPanel';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';
import { ExperimentalSettingsPanel } from './ExperimentalSettingsPanel';
import { GeneralSettingsPanel } from './GeneralSettingsPanel';
import { PricingSettingsPanel } from './PricingSettingsPanel';
import { ProvidersSettingsPanel } from './ProvidersSettingsPanel';

interface SettingsDialogContentProps {
  state: SettingsDialogState;
  onClose: () => void;
}

export function SettingsDialogContent({ state, onClose }: SettingsDialogContentProps) {
  switch (state.activeCategory) {
    case 'general':
      return <GeneralSettingsPanel state={state} />;
    case 'providers':
      return <ProvidersSettingsPanel state={state} />;
    case 'aiModels':
      return <AiModelsSettingsPanel />;
    case 'appearance':
      return <AppearanceSettingsPanel state={state} />;
    case 'pricing':
      return <PricingSettingsPanel state={state} />;
    case 'experimental':
      return <ExperimentalSettingsPanel state={state} />;
    case 'about':
      return <AboutSettingsPanel state={state} onClose={onClose} />;
    default:
      return null;
  }
}
