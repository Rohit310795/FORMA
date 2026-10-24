import type { AiUsageEvent, FeatureRoute, ProviderConfig } from '@forma/shared';
import type { AiServiceDeps } from '../src/ai/service';
import type { LoadedProvider } from '../src/ai/gateway';
import { AiProviderError, type GenerateArgs, type ProviderAdapter } from '../src/ai/types';

export function provider(id: string, patch: Partial<ProviderConfig> = {}, credential: 'configured' | 'missing' | 'disabled' = 'configured'): LoadedProvider {
  return {
    config: {
      id, kind: 'openai', displayName: id, enabled: true, priority: 50, timeoutMs: 5000,
      retry: { maxRetries: 1, backoffMs: 0 }, rateLimitPerMinute: 100,
      models: [{ id: 'm1', capabilities: ['text', 'json'], enabled: true, inputPricePer1M: 1, outputPricePer1M: 2 }],
      ...patch,
    },
    status: { credential: { status: credential } },
  };
}

export function route(patch: Partial<FeatureRoute> = {}): FeatureRoute {
  return {
    key: 'coachChat', enabled: true, primary: { providerId: 'a', model: 'm1' }, fallbacks: [{ providerId: 'b', model: 'm1' }],
    maxOutputTokens: 500, timeoutMs: 5000, perUserPerHour: 10, perUserPerDay: 50, safetyPolicy: 'health', contextCategories: [], temperature: 0.3,
    ...patch,
  };
}

export type Script = (args: GenerateArgs, providerId: string) => Promise<{ text: string; inputTokens?: number; outputTokens?: number }>;

export function makeDeps(opts: { providers: LoadedProvider[]; script: Script; route?: FeatureRoute; overrides?: Partial<AiServiceDeps> }) {
  const usage: AiUsageEvent[] = [];
  const calls: { providerId: string; args: GenerateArgs }[] = [];
  const map = new Map(opts.providers.map((p) => [p.config.id, p]));
  let currentProvider = '';
  const adapter: ProviderAdapter = {
    kind: 'openai',
    supports: ['text', 'json'],
    async generate(args) {
      calls.push({ providerId: currentProvider, args });
      return opts.script(args, currentProvider);
    },
    async healthCheck() {
      return { ok: true, latencyMs: 1, message: 'ok' };
    },
  };
  const deps: AiServiceDeps = {
    now: () => new Date('2026-10-24T10:00:00Z'),
    loadProvider: async (id) => {
      currentProvider = id;
      return map.get(id);
    },
    getSecret: async (id) => (map.get(id)?.status.credential.status === 'configured' ? `sk-test-${id}-0000000000` : undefined),
    adapters: { openai: adapter },
    fetchImpl: async () => new Response('{}'),
    recordUsage: async (e) => {
      usage.push(e);
    },
    markProvider: async () => {},
    checkProviderBudget: async () => ({ allowed: true }),
    consumeProviderRate: async () => true,
    sleep: async () => {},
    loadRoute: async () => opts.route ?? route(),
    loadPublishedPrompt: async () => undefined,
    evaluateFeature: async () => ({ enabled: true, reason: 'on' }),
    consumeUserRate: async () => true,
    consumeUserQuota: async () => ({ allowed: true }),
    checkRouteBudget: async () => ({ allowed: true }),
    buildContext: async (_uid, cats) => `CONTEXT:${cats.join(',')}`,
    ...opts.overrides,
  };
  return { deps, usage, calls };
}

export const fail = (cls: ConstructorParameters<typeof AiProviderError>[0], retryable = false) => {
  throw new AiProviderError(cls, cls, retryable);
};
