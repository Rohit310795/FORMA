import { FEATURES, FEATURE_KEYS, rolloutBucket, type FeatureKey } from './features';
import type { Entitlement, FeatureFlag, Plan } from './schemas/admin';

export interface FeatureDecision {
  enabled: boolean;
  reason: 'override_on' | 'override_off' | 'flag_off' | 'segment' | 'platform' | 'rollout' | 'plan' | 'entitlement_expired' | 'on';
  message?: string;
}

export interface EvaluateInput {
  uid: string;
  platform?: 'ios' | 'android' | 'web';
  flags: Partial<Record<FeatureKey, FeatureFlag>>;
  entitlement?: Entitlement;
  plan?: Plan;
}

/**
 * Evaluates a feature for a user. Order: explicit admin override → global flag
 * (kill switch) → plan/segment → platform → staged rollout → plan entitlement.
 * The server is the only caller whose result is trusted.
 */
export function evaluateFeature(key: FeatureKey, input: EvaluateInput): FeatureDecision {
  const def = FEATURES[key];
  const override = input.entitlement?.featureOverrides?.[key];
  const flag = input.flags[key];
  const message = flag?.message || def.disabledMessage;
  // A global kill switch wins even over a per-user "on" override.
  if (flag && !flag.enabled) return { enabled: false, reason: 'flag_off', message };
  if (override === false) return { enabled: false, reason: 'override_off', message };
  if (override === true) return { enabled: true, reason: 'override_on' };
  if (!flag && !def.defaultEnabled) return { enabled: false, reason: 'flag_off', message };
  const planId = input.entitlement?.planId ?? 'free';
  if (flag?.plans?.length && !flag.plans.includes(planId)) return { enabled: false, reason: 'segment', message };
  if (flag?.platforms?.length && input.platform && !flag.platforms.includes(input.platform)) return { enabled: false, reason: 'platform', message };
  const pct = flag?.rolloutPercent ?? 100;
  if (pct < 100 && rolloutBucket(input.uid, key) >= pct) return { enabled: false, reason: 'rollout', message };
  if (input.entitlement?.status === 'expired' && key === 'premiumFeatures') return { enabled: false, reason: 'entitlement_expired', message };
  if (input.plan && !input.plan.features.includes(key)) return { enabled: false, reason: 'plan', message: 'This feature is part of a different plan.' };
  return { enabled: true, reason: 'on' };
}

export function evaluateAll(input: EvaluateInput): Record<FeatureKey, FeatureDecision> {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, evaluateFeature(k, input)])) as Record<FeatureKey, FeatureDecision>;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'free', name: 'Free', description: 'Core tracking and a small monthly AI allowance.',
    features: FEATURE_KEYS.filter((k) => k !== 'premiumFeatures'),
    aiDailyRequests: 10, aiMonthlyRequests: 100, trialDays: 0, billing: 'test_mode', active: true,
  },
  {
    id: 'pro', name: 'Pro', description: 'Everything in Free plus higher AI limits and premium features.',
    features: [...FEATURE_KEYS], aiDailyRequests: 60, aiMonthlyRequests: 1200, trialDays: 7, billing: 'test_mode', active: true,
  },
];
