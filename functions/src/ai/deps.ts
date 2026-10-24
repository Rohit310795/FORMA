import type { AiServiceDeps } from './service';
import { ADAPTERS } from './adapters';
import { secretStore } from '../secrets';
import { loadProvider, loadPublishedPrompt, loadRoute } from '../services/store';
import { checkProviderBudget, checkRouteBudget, consumeProviderRate, consumeUserQuota, consumeUserRate, markProvider, recordUsage } from '../services/limits';
import { featureFor } from '../services/users';
import { buildContext } from '../services/context';
import { userHash } from '../lib/ids';
import type { FeatureKey } from '@forma/shared';

/** Production wiring of the AI service: Firestore config, Secret Manager, real fetch. */
export function buildAiDeps(opts: { uid: string; daily: number; monthly: number }): AiServiceDeps {
  const hash = userHash(opts.uid);
  return {
    now: () => new Date(),
    loadProvider,
    getSecret: (id) => secretStore().get(id),
    adapters: ADAPTERS,
    fetchImpl: (url, init) => fetch(url, init),
    recordUsage,
    markProvider,
    checkProviderBudget,
    consumeProviderRate: (p) => consumeProviderRate(p),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    loadRoute,
    loadPublishedPrompt,
    evaluateFeature: (uid, feature) => featureFor(uid, feature as FeatureKey),
    consumeUserRate: (_uid, routeKey, route) => consumeUserRate(hash, routeKey, route),
    consumeUserQuota: () => consumeUserQuota(hash, opts.daily, opts.monthly),
    checkRouteBudget,
    buildContext,
  };
}
