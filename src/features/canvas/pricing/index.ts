import type { ImageModelDefinition } from '@/features/canvas/models/types';

import {
  DEFAULT_GRSAI_CREDIT_TIER_ID,
  GRSAI_CREDIT_TIERS,
  type GrsaiCreditTierDefinition,
  type GrsaiCreditTierId,
  type ModelPricingDefinition,
  type PriceComputationContext,
  type PriceCurrency,
  type PriceDisplayCurrencyMode,
  type PricingSettingsSnapshot,
} from './types';

type ResolutionPriceTable = Record<string, number>;

interface FixedResolutionPricingConfig {
  currency: PriceCurrency;
  standardRates: ResolutionPriceTable;
  discountedRates?: ResolutionPriceTable;
}

interface MultiplierPricingConfig {
  currency: PriceCurrency;
  baseAmount: number;
  resolutionMultipliers: ResolutionPriceTable;
  resolveExtraCharges?: (context: PriceComputationContext) => number;
}

interface ModelPriceDisplay {
  label: string;
  nativeLabel?: string;
  originalLabel?: string;
  pointsCost?: number;
  grsaiCreditTier?: GrsaiCreditTierDefinition;
}

const DEFAULT_PRICING_SETTINGS: PricingSettingsSnapshot = {
  displayCurrencyMode: 'auto',
  usdToCnyRate: 7.2,
  preferDiscountedPrice: false,
  grsaiCreditTierId: DEFAULT_GRSAI_CREDIT_TIER_ID,
};

const PER_RUN_SUFFIX = '/次';

function toFiniteAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeStringParam(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null;
}

function convertCurrency(amount: number, from: PriceCurrency, to: PriceCurrency, usdToCnyRate: number): number {
  const safeRate = Number.isFinite(usdToCnyRate) && usdToCnyRate > 0 ? usdToCnyRate : 7.2;
  if (from === to) {
    return amount;
  }

  if (from === 'USD' && to === 'CNY') {
    return amount * safeRate;
  }

  return amount / safeRate;
}

function formatCurrency(amount: number, currency: PriceCurrency): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toFiniteAmount(amount));
}

export function resolvePriceDisplayCurrency(mode: PriceDisplayCurrencyMode): PriceCurrency {
  if (mode === 'usd') {
    return 'USD';
  }

  return 'CNY';
}

export function getGrsaiCreditTier(
  tierId: GrsaiCreditTierId | string | null | undefined
): GrsaiCreditTierDefinition {
  return (
    GRSAI_CREDIT_TIERS.find((tier) => tier.id === tierId) ??
    GRSAI_CREDIT_TIERS.find((tier) => tier.id === DEFAULT_GRSAI_CREDIT_TIER_ID) ??
    GRSAI_CREDIT_TIERS[0]
  );
}

export function createFixedResolutionPricing(
  config: FixedResolutionPricingConfig
): ModelPricingDefinition {
  return {
    quote: ({ resolution, settings }) => {
      const standardAmount = config.standardRates[resolution];
      if (!Number.isFinite(standardAmount)) {
        return null;
      }

      const discountedAmount =
        settings.preferDiscountedPrice && config.discountedRates
          ? config.discountedRates[resolution]
          : undefined;

      if (typeof discountedAmount === 'number' && Number.isFinite(discountedAmount)) {
        return {
          amount: discountedAmount,
          currency: config.currency,
          originalAmount: standardAmount,
          originalCurrency: config.currency,
        };
      }

      return {
        amount: standardAmount,
        currency: config.currency,
      };
    },
  };
}

export function createMultiplierPricing(
  config: MultiplierPricingConfig
): ModelPricingDefinition {
  return {
    quote: (context) => {
      const multiplier = config.resolutionMultipliers[context.resolution];
      if (!Number.isFinite(multiplier)) {
        return null;
      }

      const extraCharges = config.resolveExtraCharges?.(context) ?? 0;
      return {
        amount: config.baseAmount * multiplier + extraCharges,
        currency: config.currency,
      };
    },
  };
}

export function createGrsaiPointsPricing(
  resolvePointsCost: (context: PriceComputationContext) => number
): ModelPricingDefinition {
  return {
    quote: (context) => {
      const pointsCost = resolvePointsCost(context);
      if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
        return null;
      }

      const creditTier = getGrsaiCreditTier(context.settings.grsaiCreditTierId);
      return {
        amount: (creditTier.priceCny * pointsCost) / creditTier.credits,
        currency: 'CNY',
        pointsCost,
        metadata: {
          grsaiCreditTierId: creditTier.id,
        },
      };
    },
  };
}

export function resolveModelPriceDisplay(
  model: ImageModelDefinition,
  options: {
    resolution: string;
    extraParams?: Record<string, unknown>;
    settings?: Partial<PricingSettingsSnapshot>;
  }
): ModelPriceDisplay | null {
  if (!model.pricing) {
    return null;
  }

  const pricingSettings: PricingSettingsSnapshot = {
    ...DEFAULT_PRICING_SETTINGS,
    ...options.settings,
  };
  const quote = model.pricing.quote({
    resolution: options.resolution,
    extraParams: options.extraParams,
    settings: pricingSettings,
  });
  if (!quote) {
    return null;
  }

  const displayCurrency = resolvePriceDisplayCurrency(pricingSettings.displayCurrencyMode);
  const displayAmount = convertCurrency(
    quote.amount,
    quote.currency,
    displayCurrency,
    pricingSettings.usdToCnyRate
  );
  const nativeLabel =
    quote.currency === displayCurrency
      ? undefined
      : `${formatCurrency(quote.amount, quote.currency)}${PER_RUN_SUFFIX}`;
  const originalDisplayAmount =
    quote.originalAmount != null
      ? convertCurrency(
        quote.originalAmount,
        quote.originalCurrency ?? quote.currency,
        displayCurrency,
        pricingSettings.usdToCnyRate
      )
      : null;
  const grsaiCreditTierId = normalizeStringParam(quote.metadata?.grsaiCreditTierId);

  return {
    label: `${formatCurrency(displayAmount, displayCurrency)}${PER_RUN_SUFFIX}`,
    nativeLabel,
    originalLabel:
      originalDisplayAmount != null
        ? `${formatCurrency(originalDisplayAmount, displayCurrency)}${PER_RUN_SUFFIX}`
        : undefined,
    pointsCost: quote.pointsCost,
    grsaiCreditTier: grsaiCreditTierId ? getGrsaiCreditTier(grsaiCreditTierId) : undefined,
  };
}

export function isHighThinkingEnabled(extraParams: Record<string, unknown> | undefined): boolean {
  return normalizeStringParam(extraParams?.thinking_level) === 'high';
}
