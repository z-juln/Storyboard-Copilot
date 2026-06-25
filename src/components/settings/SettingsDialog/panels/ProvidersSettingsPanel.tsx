import { Eye, EyeOff } from 'lucide-react';

import { UiSelect } from '@/components/ui';
import { GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS } from '@/features/canvas/models/providers/grsai';

import { PROVIDER_GET_KEY_URLS, PROVIDER_REGISTER_URLS } from '../constants';
import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface ProvidersSettingsPanelProps {
  state: SettingsDialogState;
}

export function ProvidersSettingsPanel({ state }: ProvidersSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="密钥"
      description="配置 AI 服务商的 API 密钥"
      onSave={state.handleSave}
    >
      {state.providers.map((provider) => {
        const isRevealed = Boolean(state.revealedApiKeys[provider.id]);

        return (
          <div key={provider.id} className="rounded-lg border border-border-dark bg-bg-dark p-4">
            <div className="mb-3">
              <h3 className="text-sm font-medium text-text-dark">{provider.label}</h3>
              {PROVIDER_REGISTER_URLS[provider.id] && PROVIDER_GET_KEY_URLS[provider.id] ? (
                <p className="text-xs text-text-muted">
                  首先{' '}
                  <a
                    href={PROVIDER_REGISTER_URLS[provider.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    点击这里注册
                  </a>
                  ，然后{' '}
                  <a
                    href={PROVIDER_GET_KEY_URLS[provider.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    点击这里获取密钥
                  </a>
                </p>
              ) : (
                <p className="text-xs text-text-muted">{provider.id}</p>
              )}
            </div>

            <div className="relative">
              <input
                type={isRevealed ? 'text' : 'password'}
                value={state.localApiKeys[provider.id] ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  state.setLocalApiKeys((previous) => ({
                    ...previous,
                    [provider.id]: nextValue,
                  }));
                  state.setProviderApiKey(provider.id, nextValue);
                }}
                placeholder="输入 API Key"
                className="w-full rounded border border-border-dark bg-surface-dark px-3 py-2 pr-10 text-sm text-text-dark placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={() =>
                  state.setRevealedApiKeys((previous) => ({
                    ...previous,
                    [provider.id]: !isRevealed,
                  }))
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-bg-dark"
              >
                {isRevealed ? (
                  <EyeOff className="h-4 w-4 text-text-muted" />
                ) : (
                  <Eye className="h-4 w-4 text-text-muted" />
                )}
              </button>
            </div>

            {provider.id === 'grsai' ? (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-text-dark">
                  Nano Banana Pro 接入模型
                </div>
                <p className="mb-2 text-xs text-text-muted">
                  切换该供应商 Nano Banana Pro 的接入点，当一个接入点失效时可尝试切换，具体请查阅
                  <a
                    href="https://grsai.com/zh/dashboard/models"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline"
                  >
                    模型列表
                  </a>
                  。
                </p>
                <UiSelect
                  value={state.localGrsaiNanoBananaProModel}
                  onChange={(event) => state.setLocalGrsaiNanoBananaProModel(event.target.value)}
                  className="h-9 text-sm"
                >
                  {GRSAI_NANO_BANANA_PRO_MODEL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </UiSelect>
              </div>
            ) : null}
          </div>
        );
      })}
    </SettingsPanelShell>
  );
}
