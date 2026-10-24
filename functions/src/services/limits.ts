import type { AiRouteKey, AiUsageEvent, FeatureRoute, ProviderConfig } from '@forma/shared';
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { USAGE_RETENTION_DAYS } from '../lib/config';
import { logger } from '../lib/logger';
import type { BudgetDecision } from '../ai/gateway';
import type { ErrorClass } from '../ai/types';
import { loadBudgets } from './store';

const expireIn = (ms: number) => Timestamp.fromMillis(Date.now() + ms);
const H = 3_600_000;
const D = 24 * H;
const safeKey = (k: string) => k.replace(/[./\s]/g, '_').slice(0, 120);
const stamp = (d: Date, len: number) => d.toISOString().replace(/[-:T]/g, '').slice(0, len);

/**
 * Atomically consumes one unit from each counter if all are under their limit.
 * Counters carry `expireAt` so a Firestore TTL policy can clean them up.
 */
export async function consumeCounters(counters: { id: string; limit: number; ttlMs: number }[]): Promise<boolean> {
  const refs = counters.map((c) => db.doc(`counters/${c.id}`));
  return db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    for (const [i, s] of snaps.entries()) if ((s.data()?.count ?? 0) >= counters[i]!.limit) return false;
    snaps.forEach((s, i) => tx.set(refs[i]!, { count: (s.data()?.count ?? 0) + 1, expireAt: expireIn(counters[i]!.ttlMs) }, { merge: true }));
    return true;
  });
}

export function consumeUserRate(userHash: string, routeKey: AiRouteKey, route: FeatureRoute, now = new Date()) {
  return consumeCounters([
    { id: `rate_${userHash}_${routeKey}_h${stamp(now, 10)}`, limit: route.perUserPerHour, ttlMs: 2 * H },
    { id: `rate_${userHash}_${routeKey}_d${stamp(now, 8)}`, limit: route.perUserPerDay, ttlMs: 2 * D },
  ]);
}

export async function consumeUserQuota(userHash: string, daily: number, monthly: number, now = new Date()) {
  const dayOk = await consumeCounters([{ id: `quota_${userHash}_d${stamp(now, 8)}`, limit: daily, ttlMs: 2 * D }]);
  if (!dayOk) return { allowed: false, reason: 'daily' as const };
  const monthOk = await consumeCounters([{ id: `quota_${userHash}_m${stamp(now, 6)}`, limit: monthly, ttlMs: 40 * D }]);
  return monthOk ? { allowed: true } : { allowed: false, reason: 'monthly' as const };
}

export async function quotaUsage(userHash: string, now = new Date()) {
  const [d, m] = await Promise.all([
    db.doc(`counters/quota_${userHash}_d${stamp(now, 8)}`).get(),
    db.doc(`counters/quota_${userHash}_m${stamp(now, 6)}`).get(),
  ]);
  return { today: d.data()?.count ?? 0, month: m.data()?.count ?? 0 };
}

export function consumeProviderRate(provider: ProviderConfig, now = new Date()) {
  return consumeCounters([{ id: `prov_${provider.id}_${stamp(now, 12)}`, limit: provider.rateLimitPerMinute, ttlMs: 10 * 60_000 }]);
}

export function consumeAdminRate(uid: string, now = new Date()) {
  return consumeCounters([{ id: `admin_${uid}_${stamp(now, 12)}`, limit: 120, ttlMs: 10 * 60_000 }]);
}

/** Writes the raw (pseudonymous) event and increments daily + monthly roll-ups. */
export async function recordUsage(e: AiUsageEvent): Promise<void> {
  try {
    const month = e.dayKey.slice(0, 7);
    const inc = (n = 1) => FieldValue.increment(n);
    const cost = e.costMicroUsd ?? 0;
    const delta = {
      [`outcomes`]: { [e.outcome]: inc() },
      inputTokens: inc(e.inputTokens ?? 0),
      outputTokens: inc(e.outputTokens ?? 0),
      costMicroUsd: inc(cost),
      ...(e.providerId
        ? {
            byProvider: { [safeKey(e.providerId)]: { [e.outcome]: inc(), costMicroUsd: inc(cost), inputTokens: inc(e.inputTokens ?? 0), outputTokens: inc(e.outputTokens ?? 0) } },
            byModel: { [safeKey(`${e.providerId}__${e.model ?? ''}`)]: { [e.outcome]: inc(), costMicroUsd: inc(cost) } },
          }
        : {}),
      byRoute: { [e.routeKey]: { [e.outcome]: inc(), costMicroUsd: inc(cost) } },
      updatedAt: FieldValue.serverTimestamp(),
    };
    const batch = db.batch();
    batch.set(db.collection('aiUsageEvents').doc(), { ...e, expireAt: expireIn(USAGE_RETENTION_DAYS * D) });
    batch.set(db.doc(`aiUsageDaily/${e.dayKey}`), { dayKey: e.dayKey, ...delta }, { merge: true });
    batch.set(db.doc(`aiUsageMonthly/${month}`), { month, ...delta }, { merge: true });
    await batch.commit();
  } catch (err) {
    // Usage logging must never break a user request.
    logger.warn('usage_record_failed', { requestId: e.requestId, message: (err as Error).message });
  }
}

export async function markProvider(providerId: string, result: { ok: boolean; errorClass?: ErrorClass }) {
  const now = new Date().toISOString();
  await db
    .doc(`aiProviderMetadata/${providerId}`)
    .set({ status: result.ok ? { lastSuccessAt: now } : { lastErrorAt: now, lastErrorClass: result.errorClass ?? 'unknown' } }, { merge: true })
    .catch(() => undefined);
}

async function spend(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const [d, m] = await Promise.all([db.doc(`aiUsageDaily/${day}`).get(), db.doc(`aiUsageMonthly/${day.slice(0, 7)}`).get()]);
  return { day: d.data() ?? {}, month: m.data() ?? {}, dayKey: day };
}

const usd = (micro: number | undefined) => (micro ?? 0) / 1_000_000;

async function warnOnce(scope: string, dayKey: string, pct: number) {
  const ref = db.doc(`budgetAlerts/${safeKey(scope)}_${dayKey}`);
  const created = await ref.create({ scope, dayKey, percent: Math.round(pct), at: new Date().toISOString() }).then(() => true, () => false);
  if (created) logger.warn('budget_threshold', { scope, percent: Math.round(pct) });
}

function evaluate(scope: string, spentUsd: number, limitUsd: number | undefined, warnAt: number, dayKey: string, onExceeded: 'block' | 'allow_and_alert'): BudgetDecision | undefined {
  if (limitUsd === undefined || limitUsd <= 0) return undefined;
  const pct = (spentUsd / limitUsd) * 100;
  if (pct >= warnAt) void warnOnce(scope, dayKey, pct);
  if (spentUsd >= limitUsd && onExceeded === 'block') return { allowed: false, reason: `${scope} budget reached` };
  return undefined;
}

/** Global + route budgets, checked before a request is sent anywhere. */
export async function checkRouteBudget(route: FeatureRoute): Promise<BudgetDecision> {
  const [b, s] = await Promise.all([loadBudgets(), spend()]);
  const routeDay = (s.day.byRoute as Record<string, { costMicroUsd?: number }> | undefined)?.[route.key]?.costMicroUsd;
  const routeMonth = (s.month.byRoute as Record<string, { costMicroUsd?: number }> | undefined)?.[route.key]?.costMicroUsd;
  return (
    evaluate('global:daily', usd(s.day.costMicroUsd as number), b.globalDailyUsd, b.warnAtPercent, s.dayKey, b.onExceeded) ??
    evaluate('global:monthly', usd(s.month.costMicroUsd as number), b.globalMonthlyUsd, b.warnAtPercent, s.dayKey, b.onExceeded) ??
    evaluate(`route:${route.key}:daily`, usd(routeDay), route.dailyBudgetUsd, b.warnAtPercent, s.dayKey, b.onExceeded) ??
    evaluate(`route:${route.key}:monthly`, usd(routeMonth), route.monthlyBudgetUsd, b.warnAtPercent, s.dayKey, b.onExceeded) ?? { allowed: true }
  );
}

/** Provider budgets: an exhausted provider is skipped so the fallback chain can continue. */
export async function checkProviderBudget(provider: ProviderConfig): Promise<BudgetDecision> {
  const [b, s] = await Promise.all([loadBudgets(), spend()]);
  const key = safeKey(provider.id);
  const day = (s.day.byProvider as Record<string, { costMicroUsd?: number }> | undefined)?.[key]?.costMicroUsd;
  const month = (s.month.byProvider as Record<string, { costMicroUsd?: number }> | undefined)?.[key]?.costMicroUsd;
  return (
    evaluate(`provider:${provider.id}:daily`, usd(day), provider.dailyBudgetUsd, b.warnAtPercent, s.dayKey, 'block') ??
    evaluate(`provider:${provider.id}:monthly`, usd(month), provider.monthlyBudgetUsd, b.warnAtPercent, s.dayKey, 'block') ?? { allowed: true }
  );
}
