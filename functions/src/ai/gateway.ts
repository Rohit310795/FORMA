import {
  estimateCostMicroUsd,
  estimateTokens,
  type AiRouteKey,
  type AiUsageEvent,
  type FeatureRoute,
  type ModelConfig,
  type ProviderConfig,
  type ProviderStatus,
  type RouteTarget,
} from '@forma/shared';
import { AiProviderError, type ChatTurn, type ErrorClass, type FetchLike, type ProviderAdapter } from './types';

export interface LoadedProvider {
  config: ProviderConfig;
  status: ProviderStatus;
}

export interface BudgetDecision {
  allowed: boolean;
  scope?: 'global' | 'route' | 'provider';
  reason?: string;
}

/** Everything the gateway touches is injected, so it can be tested without a network or database. */
export interface GatewayDeps {
  now: () => Date;
  loadProvider: (id: string) => Promise<LoadedProvider | undefined>;
  getSecret: (providerId: string) => Promise<string | undefined>;
  adapters: Record<string, ProviderAdapter>;
  fetchImpl: FetchLike;
  recordUsage: (event: AiUsageEvent) => Promise<void>;
  markProvider: (providerId: string, result: { ok: boolean; errorClass?: ErrorClass }) => Promise<void>;
  checkProviderBudget: (provider: ProviderConfig) => Promise<BudgetDecision>;
  consumeProviderRate: (provider: ProviderConfig) => Promise<boolean>;
  sleep: (ms: number) => Promise<void>;
}

export interface GatewayRequest {
  routeKey: AiRouteKey;
  route: FeatureRoute;
  requestId: string;
  userHash: string;
  system: string;
  messages: ChatTurn[];
  json?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}

export type GatewayResult =
  | {
      ok: true;
      text: string;
      providerId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costMicroUsd?: number;
      attempts: number;
      fallbackUsed: boolean;
    }
  | { ok: false; errorClass: ErrorClass | 'no_route' | 'all_unavailable'; attempts: number; skipped: string[] };

/** Hard cap on total provider calls per user request, whatever the config says. */
export const MAX_TOTAL_ATTEMPTS = 6;

function targetsFor(route: FeatureRoute): RouteTarget[] {
  const out: RouteTarget[] = [];
  const seen = new Set<string>();
  for (const t of [route.primary, ...route.fallbacks]) {
    if (!t) continue;
    const key = `${t.providerId}/${t.model}`;
    if (seen.has(key)) continue; // never call the same model twice in one chain
    seen.add(key);
    out.push(t);
  }
  return out;
}

export async function runGateway(req: GatewayRequest, deps: GatewayDeps): Promise<GatewayResult> {
  const targets = targetsFor(req.route);
  if (!targets.length) return { ok: false, errorClass: 'no_route', attempts: 0, skipped: [] };

  let attempts = 0;
  let lastError: ErrorClass = 'unknown';
  const skipped: string[] = [];
  const dayKey = deps.now().toISOString().slice(0, 10);
  const base = { dayKey, userHash: req.userHash, routeKey: req.routeKey, requestId: req.requestId };

  for (const [index, target] of targets.entries()) {
    if (req.signal?.aborted) return { ok: false, errorClass: 'cancelled', attempts, skipped };
    const loaded = await deps.loadProvider(target.providerId);
    const model: ModelConfig | undefined = loaded?.config.models.find((m) => m.id === target.model && m.enabled);
    const adapter = loaded ? deps.adapters[loaded.config.kind] : undefined;
    const why =
      !loaded ? 'provider_missing'
      : !loaded.config.enabled ? 'provider_disabled'
      : loaded.status.credential.status !== 'configured' ? 'credential_unavailable'
      : !model ? 'model_unavailable'
      : !adapter ? 'adapter_missing'
      : req.json && !(model.capabilities.includes('json') && adapter.supports.includes('json')) ? 'capability_missing'
      : undefined;
    if (why || !loaded || !model || !adapter) {
      skipped.push(`${target.providerId}/${target.model}:${why}`);
      continue;
    }
    const budget = await deps.checkProviderBudget(loaded.config);
    if (!budget.allowed) {
      skipped.push(`${target.providerId}:budget`);
      await deps.recordUsage({ ...base, at: deps.now().toISOString(), providerId: target.providerId, model: target.model, outcome: 'blocked_budget', attempt: attempts + 1 });
      continue;
    }
    if (!(await deps.consumeProviderRate(loaded.config))) {
      skipped.push(`${target.providerId}:rate`);
      await deps.recordUsage({ ...base, at: deps.now().toISOString(), providerId: target.providerId, model: target.model, outcome: 'blocked_rate', attempt: attempts + 1 });
      continue;
    }
    const apiKey = await deps.getSecret(target.providerId);
    if (!apiKey) {
      skipped.push(`${target.providerId}:secret_missing`);
      continue;
    }

    const maxTries = 1 + Math.min(loaded.config.retry.maxRetries, 3);
    for (let attempt = 1; attempt <= maxTries; attempt++) {
      if (attempts >= MAX_TOTAL_ATTEMPTS) return { ok: false, errorClass: lastError, attempts, skipped };
      attempts++;
      const started = Date.now();
      const timeoutMs = Math.min(req.route.timeoutMs, loaded.config.timeoutMs);
      const maxOutputTokens = Math.min(req.route.maxOutputTokens, model.maxOutputTokens ?? Number.MAX_SAFE_INTEGER);
      try {
        const res = await adapter.generate(
          {
            apiKey,
            baseUrl: loaded.config.baseUrl,
            model: model.id,
            system: req.system,
            messages: req.messages,
            maxOutputTokens,
            temperature: req.route.temperature,
            timeoutMs,
            json: req.json,
            signal: req.signal,
          },
          deps.fetchImpl,
        );
        const inputTokens = res.inputTokens ?? estimateTokens(req.system + req.messages.map((m) => m.content).join('\n'));
        const outputTokens = res.outputTokens ?? estimateTokens(res.text);
        const costMicroUsd = estimateCostMicroUsd(inputTokens, outputTokens, model.inputPricePer1M, model.outputPricePer1M);
        await deps.recordUsage({
          ...base,
          at: deps.now().toISOString(),
          providerId: target.providerId,
          model: model.id,
          outcome: index > 0 ? 'fallback' : 'success',
          attempt: attempts,
          inputTokens,
          outputTokens,
          costMicroUsd,
          latencyMs: Date.now() - started,
        });
        await deps.markProvider(target.providerId, { ok: true });
        return { ok: true, text: res.text, providerId: target.providerId, model: model.id, inputTokens, outputTokens, costMicroUsd, attempts, fallbackUsed: index > 0 };
      } catch (err) {
        const e = err instanceof AiProviderError ? err : new AiProviderError('unknown', (err as Error)?.message ?? 'error');
        lastError = e.errorClass;
        await deps.recordUsage({
          ...base,
          at: deps.now().toISOString(),
          providerId: target.providerId,
          model: model.id,
          outcome: 'error',
          errorClass: e.errorClass,
          attempt: attempts,
          latencyMs: Date.now() - started,
        });
        await deps.markProvider(target.providerId, { ok: false, errorClass: e.errorClass });
        if (e.errorClass === 'cancelled') return { ok: false, errorClass: 'cancelled', attempts, skipped };
        // Only transient errors are retried on the same provider; others move straight to the fallback.
        if (!e.retryable || attempt === maxTries) break;
        await deps.sleep(loaded.config.retry.backoffMs * attempt);
      }
    }
  }
  return { ok: false, errorClass: attempts === 0 ? 'all_unavailable' : lastError, attempts, skipped };
}
