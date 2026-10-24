import {
  AI_ROUTES,
  appSettingsSchema,
  budgetSettingsSchema,
  DEFAULT_PLANS,
  featureFlagSchema,
  featureRouteSchema,
  planSchema,
  promptVersionSchema,
  providerConfigSchema,
  providerStatusSchema,
  type AiRouteKey,
  type AppSettings,
  type BudgetSettings,
  type FeatureFlag,
  type FeatureKey,
  type FeatureRoute,
  type Plan,
  type PromptVersion,
} from '@forma/shared';
import { db } from '../lib/firebase';
import type { LoadedProvider } from '../ai/gateway';

/**
 * Admin-managed configuration with a short in-memory cache (per function
 * instance). Writes through the admin API clear the local cache; other
 * instances pick changes up within CACHE_MS.
 */
const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export const clearConfigCache = () => cache.clear();

export function loadFlags(): Promise<Partial<Record<FeatureKey, FeatureFlag>>> {
  return cached('flags', async () => {
    const snap = await db.collection('featureFlags').get();
    const out: Partial<Record<FeatureKey, FeatureFlag>> = {};
    for (const d of snap.docs) {
      const parsed = featureFlagSchema.safeParse({ key: d.id, ...d.data() });
      if (parsed.success) out[parsed.data.key] = parsed.data;
    }
    return out;
  });
}

export function loadPlans(): Promise<Plan[]> {
  return cached('plans', async () => {
    const snap = await db.collection('plans').get();
    const stored = snap.docs.map((d) => planSchema.safeParse({ id: d.id, ...d.data() })).filter((p) => p.success).map((p) => p.data!);
    const ids = new Set(stored.map((p) => p.id));
    return [...stored, ...DEFAULT_PLANS.filter((p) => !ids.has(p.id))];
  });
}

export async function loadPlan(id: string): Promise<Plan | undefined> {
  return (await loadPlans()).find((p) => p.id === id);
}

export function loadRoute(key: AiRouteKey): Promise<FeatureRoute | undefined> {
  return cached(`route:${key}`, async () => {
    const snap = await db.doc(`aiFeatureRoutes/${key}`).get();
    if (!snap.exists) return undefined;
    const parsed = featureRouteSchema.safeParse({ key, safetyPolicy: AI_ROUTES[key].minimumSafetyPolicy, ...snap.data() });
    return parsed.success ? parsed.data : undefined;
  });
}

export function loadProvider(id: string): Promise<LoadedProvider | undefined> {
  return cached(`provider:${id}`, async () => {
    const snap = await db.doc(`aiProviderMetadata/${id}`).get();
    if (!snap.exists) return undefined;
    const data = snap.data()!;
    const config = providerConfigSchema.safeParse({ id, ...data.config });
    const status = providerStatusSchema.safeParse(data.status ?? { credential: { status: 'missing' } });
    if (!config.success || !status.success) return undefined;
    return { config: config.data, status: status.data };
  });
}

export function loadPublishedPrompt(key: AiRouteKey): Promise<PromptVersion | undefined> {
  return cached(`prompt:${key}`, async () => {
    const snap = await db.collection('promptVersions').where('routeKey', '==', key).where('status', '==', 'published').limit(1).get();
    const doc = snap.docs[0];
    if (!doc) return undefined;
    const parsed = promptVersionSchema.safeParse({ id: doc.id, ...doc.data() });
    return parsed.success ? parsed.data : undefined;
  });
}

export function loadAppSettings(): Promise<AppSettings> {
  return cached('settings', async () => {
    const snap = await db.doc('appConfig/settings').get();
    return appSettingsSchema.parse(snap.data() ?? {});
  });
}

export function loadBudgets(): Promise<BudgetSettings> {
  return cached('budgets', async () => {
    const snap = await db.doc('appConfig/budgets').get();
    return budgetSettingsSchema.parse(snap.data() ?? {});
  });
}
