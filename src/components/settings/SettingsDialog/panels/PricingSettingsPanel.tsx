import { UiSelect } from '@/components/ui';
import { GRSAI_CREDIT_TIERS } from '@/features/canvas/pricing/types';

import type { SettingsDialogState } from '../useSettingsDialogState';
import { SettingsCheckboxCard } from '../SettingsCheckboxCard';
import { SettingsPanelShell } from '../SettingsPanelShell';

interface PricingSettingsPanelProps {
  state: SettingsDialogState;
}

export function PricingSettingsPanel({ state }: PricingSettingsPanelProps) {
  return (
    <SettingsPanelShell
      title="价格"
      description="管理节点价格展示、汇率换算和积分套餐估算。"
      onSave={state.handleSave}
    >
      <SettingsCheckboxCard
        checked={state.localShowNodePrice}
        onCheckedChange={state.setLocalShowNodePrice}
        title="在节点右上角显示价格"
        description="实时根据当前模型、分辨率和附加参数显示本次运行的预计消费。"
      />

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">价格显示币种</h3>
        <p className="mt-1 text-xs text-text-muted">
          自动模式下默认显示人民币，也可手动选择美元。
        </p>
        <div className="mt-3">
          <UiSelect
            value={state.localPriceDisplayCurrencyMode}
            onChange={(event) =>
              state.setLocalPriceDisplayCurrencyMode(
                event.target.value as typeof state.localPriceDisplayCurrencyMode
              )
            }
            className="h-9 text-sm"
          >
            <option value="auto">自动（人民币）</option>
            <option value="cny">人民币</option>
            <option value="usd">美元</option>
          </UiSelect>
        </div>
      </div>

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">美元兑人民币汇率</h3>
        <p className="mt-1 text-xs text-text-muted">
          用于在美元和人民币之间换算显示价格，不影响实际平台扣费。
        </p>
        <div className="mt-3">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={state.localUsdToCnyRate}
            onChange={(event) => state.setLocalUsdToCnyRate(event.target.value)}
            className="h-9 w-full rounded border border-border-dark bg-surface-dark px-3 text-sm text-text-dark outline-none placeholder:text-text-muted"
          />
        </div>
      </div>

      <SettingsCheckboxCard
        checked={state.localPreferDiscountedPrice}
        onCheckedChange={state.setLocalPreferDiscountedPrice}
        title="优先显示折扣价"
        description="目前仅 KIE 提供原价与折扣价两套价格参考。国内优惠价通常需要向 KIE 单独申请；启用后会优先按折扣价估算。"
      />

      <div className="rounded-lg border border-border-dark bg-bg-dark p-4">
        <h3 className="text-sm font-medium text-text-dark">GRSAI 积分套餐档位</h3>
        <p className="mt-1 text-xs text-text-muted">
          GRSAI 采用积分扣费，不同充值档位对应的单次成本不同。
        </p>
        <div className="mt-3">
          <UiSelect
            value={state.localGrsaiCreditTierId}
            onChange={(event) =>
              state.setLocalGrsaiCreditTierId(event.target.value as typeof state.localGrsaiCreditTierId)
            }
            className="h-9 text-sm"
          >
            {GRSAI_CREDIT_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {`¥${tier.priceCny.toFixed(2)} / ${tier.credits.toLocaleString('zh-CN')} 积分`}
              </option>
            ))}
          </UiSelect>
        </div>
      </div>
    </SettingsPanelShell>
  );
}
