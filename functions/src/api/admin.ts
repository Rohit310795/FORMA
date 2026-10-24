import { z } from 'zod';
import {
  AI_ROUTES,
  AI_ROUTE_KEYS,
  ADMIN_ROLES,
  FEATURES,
  FEATURE_KEYS,
  SAFETY_POLICY_RANK,
  appSettingsSchema,
  budgetSettingsSchema,
  entitlementSchema,
  featureFlagSchema,
  featureRouteSchema,
  maskSuffix,
  planSchema,
  providerConfigSchema,
  type AiRouteKey,
  type Permission,
  type FeatureRoute,
} from '@forma/shared';
import { onCall, callableOptions, verifyAdmin, type AdminContext } from '../lib/callable';
import { db, auth, FieldValue, Timestamp } from '../lib/firebase';
import { PublicError, toPublicError } from '../lib/errors';
import { requestId as newRequestId, userHash } from '../lib/ids';
import { FIREBASE_WEB_API_KEY, IS_EMULATOR } from '../lib/config';
import { audit } from '../services/audit';
import { clearConfigCache, loadBudgets, loadFlags, loadPlans, loadProvider, loadRoute, loadAppSettings } from '../services/store';
import { secretStore } from '../secrets';
import { ADAPTERS } from '../ai/adapters';
import { composeSystemPrompt, effectivePolicy } from '../ai/service';
import { runGateway } from '../ai/gateway';
import { buildAiDeps } from '../ai/deps';
import { ensureUser, featuresFor } from '../services/users';
import { quotaUsage } from '../services/limits';
import { deleteUserCompletely } from '../services/accounts';
import { checkModelOutput, screenUserMessage, SAFE_FALLBACK, DISCLAIMERS } from '@forma/shared';

interface ActionResult {
  data: unknown;
  /** Present for mutations: a redacted human-readable summary for the audit log. */
  audit?: { target?: string; summary: string };
}
interface ActionDef<S extends z.ZodType> {
  permission: Permission;
  schema: S;
  run: (input: z.infer<S>, ctx: AdminContext) => Promise<ActionResult>;
}
const action = <S extends z.ZodType>(def: ActionDef<S>) => def;

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const countWhere = async (field: string, sinceIso: string) => (await db.collection('users').where(field, '>=', sinceIso).count().get()).data().count;
const providerIdSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);
const uidSchema = z.string().min(1).max(128);

function diffSummary(before: Record<string, unknown> | undefined, after: Record<string, unknown>, keys?: string[]) {
  const changed = (keys ?? Object.keys(after)).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]));
  if (!before) return 'created';
  return changed.length ? changed.map((k) => `${k}: ${JSON.stringify(before?.[k] ?? null)} → ${JSON.stringify(after[k])}`).join('; ').slice(0, 1500) : 'no changes';
}

async function rollups(collection: 'aiUsageDaily' | 'aiUsageMonthly', from: string) {
  const snap = await db.collection(collection).where(collection === 'aiUsageDaily' ? 'dayKey' : 'month', '>=', from).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Record<string, any>[];
}

function summariseUsage(docs: Record<string, any>[]) {
  const total = { success: 0, fallback: 0, error: 0, blocked: 0, safetyOverrides: 0, rateLimited: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, feedbackUp: 0, feedbackDown: 0 };
  const byProvider: Record<string, any> = {};
  const byModel: Record<string, any> = {};
  const byRoute: Record<string, any> = {};
  const merge = (target: Record<string, any>, src: Record<string, any> | undefined) => {
    for (const [k, v] of Object.entries(src ?? {})) {
      target[k] ??= {};
      for (const [m, n] of Object.entries(v as Record<string, number>)) target[k][m] = (target[k][m] ?? 0) + (n as number);
    }
  };
  for (const d of docs) {
    const o = d.outcomes ?? {};
    total.success += o.success ?? 0;
    total.fallback += o.fallback ?? 0;
    total.error += o.error ?? 0;
    total.blocked += (o.blocked_flag ?? 0) + (o.blocked_quota ?? 0) + (o.blocked_rate ?? 0) + (o.blocked_budget ?? 0) + (o.no_route ?? 0);
    total.rateLimited += o.blocked_rate ?? 0;
    total.safetyOverrides += o.safety_override ?? 0;
    total.inputTokens += d.inputTokens ?? 0;
    total.outputTokens += d.outputTokens ?? 0;
    total.costUsd += (d.costMicroUsd ?? 0) / 1e6;
    total.feedbackUp += d.feedback?.up ?? 0;
    total.feedbackDown += d.feedback?.down ?? 0;
    merge(byProvider, d.byProvider);
    merge(byModel, d.byModel);
    merge(byRoute, d.byRoute);
  }
  const attempts = total.success + total.fallback + total.error;
  return { total: { ...total, costUsd: Math.round(total.costUsd * 10000) / 10000, errorRate: attempts ? total.error / attempts : null }, byProvider, byModel, byRoute };
}

async function validateRoute(route: FeatureRoute) {
  const def = AI_ROUTES[route.key];
  if (SAFETY_POLICY_RANK[route.safetyPolicy] < SAFETY_POLICY_RANK[def.minimumSafetyPolicy]) {
    throw new PublicError('invalid-argument', `${def.label} requires at least the "${def.minimumSafetyPolicy}" safety policy.`);
  }
  const bad = route.contextCategories.filter((c) => !(def.allowedContext as readonly string[]).includes(c));
  if (bad.length) throw new PublicError('invalid-argument', `These data categories are not allowed for ${def.label}: ${bad.join(', ')}`);
  const targets = [route.primary, ...route.fallbacks].filter(Boolean) as { providerId: string; model: string }[];
  const seen = new Set<string>();
  for (const t of targets) {
    const key = `${t.providerId}/${t.model}`;
    if (seen.has(key)) throw new PublicError('invalid-argument', `${key} appears more than once in the chain.`);
    seen.add(key);
    const p = await loadProvider(t.providerId);
    if (!p) throw new PublicError('invalid-argument', `Provider "${t.providerId}" does not exist.`);
    const m = p.config.models.find((x) => x.id === t.model);
    if (!m) throw new PublicError('invalid-argument', `Model "${t.model}" is not configured on ${p.config.displayName}.`);
    if (def.requiresStructuredOutput && !m.capabilities.includes('json')) {
      throw new PublicError('invalid-argument', `${def.label} needs structured (JSON) output, which ${t.model} is not marked as supporting.`);
    }
    if (!ADAPTERS[p.config.kind].supports.includes('text')) throw new PublicError('invalid-argument', `No adapter for ${p.config.kind}.`);
  }
}

async function userSummary(uid: string) {
  const [record, userDoc, entSnap, roleSnap] = await Promise.all([
    auth.getUser(uid),
    db.doc(`users/${uid}`).get(),
    db.doc(`userEntitlements/${uid}`).get(),
    db.doc(`adminRoles/${uid}`).get(),
  ]);
  const usage = await quotaUsage(userHash(uid));
  const deletion = await db.doc(`deletionRequests/${uid}`).get();
  return {
    uid,
    email: record.email ?? null,
    emailVerified: record.emailVerified,
    providers: record.providerData.map((p) => p.providerId),
    createdAt: record.metadata.creationTime,
    lastSignInAt: record.metadata.lastSignInTime,
    lastActiveAt: userDoc.data()?.lastActiveAt ?? null,
    disabled: record.disabled,
    status: userDoc.data()?.status ?? 'active',
    role: (record.customClaims?.role as string | undefined) ?? roleSnap.data()?.role ?? null,
    entitlement: entSnap.data() ?? null,
    aiUsage: usage,
    deletionRequest: deletion.exists ? deletion.data() : null,
  };
}

async function sendPasswordReset(email: string) {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const key = FIREBASE_WEB_API_KEY || (IS_EMULATOR ? 'emulator-key' : '');
  if (!key) throw new PublicError('failed-precondition', 'Set FORMA_WEB_API_KEY (your Firebase Web API key) to send password-reset emails.');
  const base = emulatorHost ? `http://${emulatorHost}/identitytoolkit.googleapis.com` : 'https://identitytoolkit.googleapis.com';
  const res = await fetch(`${base}/v1/accounts:sendOobCode?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new PublicError('unavailable', 'The authentication service could not send the email.');
}

const ACTIONS = {
  // ── Overview ────────────────────────────────────────────────────────────
  'overview.get': action({
    permission: 'overview.read',
    schema: z.object({}),
    run: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [totalUsers, new7, new30, active1, active7, active30, flags, providers, routes, daily, monthly, budgets, recentAudit] = await Promise.all([
        db.collection('users').count().get().then((s) => s.data().count),
        countWhere('createdAt', days(7)),
        countWhere('createdAt', days(30)),
        countWhere('lastActiveAt', days(1)),
        countWhere('lastActiveAt', days(7)),
        countWhere('lastActiveAt', days(30)),
        loadFlags(),
        db.collection('aiProviderMetadata').get(),
        db.collection('aiFeatureRoutes').get(),
        rollups('aiUsageDaily', today),
        rollups('aiUsageMonthly', today.slice(0, 7)),
        loadBudgets(),
        db.collection('adminAuditLogs').orderBy('at', 'desc').limit(10).get(),
      ]);
      const month = summariseUsage(monthly);
      const featureStates = FEATURE_KEYS.map((k) => ({ key: k, label: FEATURES[k].label, aiPowered: FEATURES[k].aiPowered, enabled: flags[k]?.enabled ?? FEATURES[k].defaultEnabled, rolloutPercent: flags[k]?.rolloutPercent ?? 100 }));
      return {
        data: {
          generatedAt: new Date().toISOString(),
          users: { total: totalUsers, new7, new30, active1, active7, active30, activeDefinition: 'Signed-in users who opened the app (lastActiveAt, updated at most hourly).' },
          features: featureStates,
          usageToday: summariseUsage(daily),
          usageMonth: month,
          budgets: {
            settings: budgets,
            monthUtilisation: budgets.globalMonthlyUsd ? month.total.costUsd / budgets.globalMonthlyUsd : null,
            todayUtilisation: budgets.globalDailyUsd ? summariseUsage(daily).total.costUsd / budgets.globalDailyUsd : null,
          },
          providers: providers.docs.map((d) => ({ id: d.id, displayName: d.data().config?.displayName, kind: d.data().config?.kind, enabled: d.data().config?.enabled, status: d.data().status })),
          routesConfigured: routes.docs.filter((d) => d.data().primary).length,
          routesTotal: AI_ROUTE_KEYS.length,
          recentAudit: recentAudit.docs.map((d) => ({ id: d.id, ...d.data() })),
          system: { functions: 'ok', firestore: 'ok', emulator: IS_EMULATOR },
          unavailable: ['App crash rate — no crash reporting service is configured yet.', 'Revenue — no payment provider is integrated (plans run in test mode).'],
          costNote: 'Costs are estimates from the per-model prices you entered and token counts reported by providers.',
        },
      };
    },
  }),

  // ── AI providers ────────────────────────────────────────────────────────
  'providers.list': action({
    permission: 'providers.read',
    schema: z.object({}),
    run: async () => {
      const snap = await db.collection('aiProviderMetadata').get();
      return { data: snap.docs.map((d) => ({ id: d.id, config: d.data().config, status: d.data().status ?? { credential: { status: 'missing' } } })) };
    },
  }),
  'providers.upsert': action({
    permission: 'providers.write',
    schema: providerConfigSchema,
    run: async (config) => {
      if (config.kind === 'openai_compatible' && !config.baseUrl) throw new PublicError('invalid-argument', 'A base URL is required for OpenAI-compatible providers.');
      if (config.defaultModel && !config.models.some((m) => m.id === config.defaultModel)) throw new PublicError('invalid-argument', 'The default model must be one of the configured models.');
      const ref = db.doc(`aiProviderMetadata/${config.id}`);
      const before = (await ref.get()).data();
      await ref.set({ config, ...(before ? {} : { status: { credential: { status: 'missing' } } }), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `provider:${config.id}`, summary: diffSummary(before?.config, config, ['displayName', 'enabled', 'models', 'defaultModel', 'priority', 'timeoutMs', 'retry', 'rateLimitPerMinute', 'dailyBudgetUsd', 'monthlyBudgetUsd', 'baseUrl']) } };
    },
  }),
  'providers.setKey': action({
    permission: 'providers.secrets',
    schema: z.object({ providerId: providerIdSchema, apiKey: z.string().trim().min(8).max(1000), testBeforeSave: z.boolean().default(true) }),
    run: async ({ providerId, apiKey, testBeforeSave }) => {
      const p = await loadProvider(providerId);
      if (!p) throw new PublicError('not-found', 'Provider not found.');
      if (testBeforeSave) {
        const res = await ADAPTERS[p.config.kind].healthCheck({ apiKey, baseUrl: p.config.baseUrl, timeoutMs: 10_000 }, (u, i) => fetch(u, i));
        await db.doc(`aiProviderMetadata/${providerId}`).set({ status: { lastHealthCheck: { at: new Date().toISOString(), ok: res.ok, latencyMs: res.latencyMs, message: res.message.slice(0, 180) } } }, { merge: true });
        if (!res.ok) throw new PublicError('failed-precondition', `The key was not saved — connection test failed: ${res.message.slice(0, 180)}`);
      }
      const { ref } = await secretStore().put(providerId, apiKey);
      const credential = { status: 'configured', maskedSuffix: maskSuffix(apiKey), secretRef: ref, rotatedAt: new Date().toISOString() };
      await db.doc(`aiProviderMetadata/${providerId}`).set({ status: { credential } }, { merge: true });
      clearConfigCache();
      // Only safe metadata goes back to the browser.
      return { data: { credential: { status: credential.status, maskedSuffix: credential.maskedSuffix, rotatedAt: credential.rotatedAt } }, audit: { target: `provider:${providerId}`, summary: `credential set/rotated (${credential.maskedSuffix}); tested: ${testBeforeSave}` } };
    },
  }),
  'providers.disableKey': action({
    permission: 'providers.secrets',
    schema: z.object({ providerId: providerIdSchema }),
    run: async ({ providerId }) => {
      await secretStore().disable(providerId);
      await db.doc(`aiProviderMetadata/${providerId}`).set({ status: { credential: { status: 'disabled' } } }, { merge: true });
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `provider:${providerId}`, summary: 'credential disabled' } };
    },
  }),
  'providers.test': action({
    permission: 'providers.write',
    schema: z.object({ providerId: providerIdSchema }),
    run: async ({ providerId }) => {
      const p = await loadProvider(providerId);
      if (!p) throw new PublicError('not-found', 'Provider not found.');
      const key = await secretStore().get(providerId);
      const res = key
        ? await ADAPTERS[p.config.kind].healthCheck({ apiKey: key, baseUrl: p.config.baseUrl, timeoutMs: Math.min(p.config.timeoutMs, 15_000) }, (u, i) => fetch(u, i))
        : { ok: false, latencyMs: 0, message: 'No active credential is configured.' };
      const check = { at: new Date().toISOString(), ok: res.ok, latencyMs: res.latencyMs, message: res.message.slice(0, 180) };
      await db.doc(`aiProviderMetadata/${providerId}`).set({ status: { lastHealthCheck: check } }, { merge: true });
      await db.collection(`aiProviderMetadata/${providerId}/healthChecks`).add({ ...check, expireAt: Timestamp.fromMillis(Date.now() + 30 * 86_400_000) });
      clearConfigCache();
      return { data: check, audit: { target: `provider:${providerId}`, summary: `connectivity test: ${res.ok ? 'ok' : 'failed'}` } };
    },
  }),
  'providers.healthHistory': action({
    permission: 'providers.read',
    schema: z.object({ providerId: providerIdSchema }),
    run: async ({ providerId }) => {
      const snap = await db.collection(`aiProviderMetadata/${providerId}/healthChecks`).orderBy('at', 'desc').limit(20).get();
      return { data: snap.docs.map((d) => { const { expireAt, ...rest } = d.data(); void expireAt; return rest; }) };
    },
  }),
  'providers.delete': action({
    permission: 'providers.secrets',
    schema: z.object({ providerId: providerIdSchema, confirm: z.string() }),
    run: async ({ providerId, confirm }) => {
      if (confirm !== providerId) throw new PublicError('invalid-argument', 'Type the provider id to confirm removal.');
      const routes = await db.collection('aiFeatureRoutes').get();
      const used = routes.docs.filter((d) => [d.data().primary, ...(d.data().fallbacks ?? [])].some((t: { providerId?: string } | undefined) => t?.providerId === providerId)).map((d) => d.id);
      if (used.length) throw new PublicError('failed-precondition', `Remove this provider from these routes first: ${used.join(', ')}`);
      await secretStore().remove(providerId);
      await db.recursiveDelete(db.doc(`aiProviderMetadata/${providerId}`));
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `provider:${providerId}`, summary: 'provider removed and credential destroyed' } };
    },
  }),

  // ── Feature → model routing ─────────────────────────────────────────────
  'routes.list': action({
    permission: 'routing.read',
    schema: z.object({}),
    run: async () => {
      const snap = await db.collection('aiFeatureRoutes').get();
      const stored = new Map(snap.docs.map((d) => [d.id, d.data()]));
      return {
        data: AI_ROUTE_KEYS.map((key) => ({
          definition: AI_ROUTES[key],
          route: stored.get(key) ?? null,
        })),
      };
    },
  }),
  'routes.upsert': action({
    permission: 'routing.write',
    schema: featureRouteSchema,
    run: async (route) => {
      await validateRoute(route);
      const ref = db.doc(`aiFeatureRoutes/${route.key}`);
      const before = (await ref.get()).data();
      await ref.set(route);
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `route:${route.key}`, summary: diffSummary(before, route as unknown as Record<string, unknown>) } };
    },
  }),

  // ── Feature flags ───────────────────────────────────────────────────────
  'flags.list': action({
    permission: 'flags.read',
    schema: z.object({}),
    run: async () => {
      const flags = await loadFlags();
      return { data: FEATURE_KEYS.map((k) => ({ definition: FEATURES[k], flag: flags[k] ?? { key: k, enabled: FEATURES[k].defaultEnabled, rolloutPercent: 100, plans: [], platforms: [] }, stored: Boolean(flags[k]) })) };
    },
  }),
  'flags.upsert': action({
    permission: 'flags.write',
    schema: featureFlagSchema,
    run: async (flag) => {
      const ref = db.doc(`featureFlags/${flag.key}`);
      const before = (await ref.get()).data();
      await ref.set(flag);
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `flag:${flag.key}`, summary: diffSummary(before, flag as unknown as Record<string, unknown>) } };
    },
  }),

  // ── Users ───────────────────────────────────────────────────────────────
  'users.list': action({
    permission: 'users.read',
    schema: z.object({ after: z.string().optional(), limit: z.number().int().min(1).max(50).default(25) }),
    run: async ({ after, limit }) => {
      let q = db.collection('users').orderBy('createdAt', 'desc').limit(limit);
      if (after) q = q.startAfter(after);
      const snap = await q.get();
      const records = snap.docs.length ? await auth.getUsers(snap.docs.map((d) => ({ uid: d.id }))) : { users: [] };
      const byUid = new Map(records.users.map((u) => [u.uid, u]));
      return {
        data: {
          users: snap.docs.map((d) => ({ uid: d.id, email: byUid.get(d.id)?.email ?? null, createdAt: d.data().createdAt, lastActiveAt: d.data().lastActiveAt ?? null, status: d.data().status ?? 'active', disabled: byUid.get(d.id)?.disabled ?? false })),
          next: snap.docs.length === limit ? snap.docs[snap.docs.length - 1]!.data().createdAt : null,
        },
      };
    },
  }),
  'users.search': action({
    permission: 'users.read',
    schema: z.object({ query: z.string().trim().min(3).max(200) }),
    run: async ({ query }) => {
      try {
        const rec = query.includes('@') ? await auth.getUserByEmail(query) : await auth.getUser(query);
        return { data: [await userSummary(rec.uid)] };
      } catch (err) {
        if ((err as { code?: string }).code === 'auth/user-not-found') return { data: [] };
        throw err;
      }
    },
  }),
  'users.get': action({
    permission: 'users.read',
    schema: z.object({ uid: uidSchema }),
    run: async ({ uid }) => {
      const summary = await userSummary(uid);
      const { entitlement } = await ensureUser(uid);
      const { decisions } = await featuresFor(uid, entitlement);
      return { data: { ...summary, features: decisions } };
    },
  }),
  'users.setStatus': action({
    permission: 'users.write',
    schema: z.object({ uid: uidSchema, status: z.enum(['active', 'suspended']), reason: z.string().trim().min(3).max(300) }),
    run: async ({ uid, status, reason }, ctx) => {
      if (uid === ctx.uid) throw new PublicError('failed-precondition', 'You cannot change your own account status.');
      const target = await auth.getUser(uid);
      if (target.customClaims?.role && ctx.role !== 'owner') throw new PublicError('permission-denied', 'Only the owner can change another admin’s status.');
      await auth.updateUser(uid, { disabled: status === 'suspended' });
      if (status === 'suspended') await auth.revokeRefreshTokens(uid);
      await db.doc(`users/${uid}`).set({ status, statusReason: reason, statusChangedAt: new Date().toISOString() }, { merge: true });
      return { data: { ok: true }, audit: { target: `user:${uid}`, summary: `status → ${status}: ${reason}` } };
    },
  }),
  'users.setEntitlement': action({
    permission: 'entitlements.write',
    schema: z.object({
      uid: uidSchema,
      planId: z.string().max(30),
      status: entitlementSchema.shape.status,
      featureOverrides: entitlementSchema.shape.featureOverrides,
      aiDailyOverride: z.number().int().min(0).max(100000).nullable().optional(),
      trialEndsAt: z.string().optional(),
    }),
    run: async (input, ctx) => {
      const plans = await loadPlans();
      if (!plans.some((p) => p.id === input.planId)) throw new PublicError('invalid-argument', 'Unknown plan.');
      const ref = db.doc(`userEntitlements/${input.uid}`);
      const before = (await ref.get()).data();
      const next = {
        planId: input.planId,
        status: input.status,
        source: 'admin_grant' as const,
        featureOverrides: input.featureOverrides,
        ...(input.aiDailyOverride != null ? { aiDailyOverride: input.aiDailyOverride } : {}),
        ...(input.trialEndsAt ? { trialEndsAt: input.trialEndsAt } : {}),
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.uid,
      };
      await ref.set(entitlementSchema.parse(next));
      return { data: { ok: true }, audit: { target: `user:${input.uid}`, summary: diffSummary(before, next, ['planId', 'status', 'featureOverrides', 'aiDailyOverride', 'trialEndsAt']) } };
    },
  }),
  'users.sendPasswordReset': action({
    permission: 'users.write',
    schema: z.object({ uid: uidSchema }),
    run: async ({ uid }) => {
      const rec = await auth.getUser(uid);
      if (!rec.email) throw new PublicError('failed-precondition', 'This account has no email address.');
      if (!rec.providerData.some((p) => p.providerId === 'password')) throw new PublicError('failed-precondition', 'This account signs in with Apple or Google, so it has no password to reset.');
      await sendPasswordReset(rec.email);
      return { data: { ok: true }, audit: { target: `user:${uid}`, summary: 'password reset email sent' } };
    },
  }),
  'users.requestDeletion': action({
    permission: 'users.write',
    schema: z.object({ uid: uidSchema, reason: z.string().trim().min(3).max(300) }),
    run: async ({ uid, reason }, ctx) => {
      await auth.getUser(uid);
      await db.doc(`deletionRequests/${uid}`).set({ requestedBy: ctx.uid, requestedAt: new Date().toISOString(), reason, status: 'pending' });
      return { data: { ok: true }, audit: { target: `user:${uid}`, summary: `deletion requested: ${reason}` } };
    },
  }),
  'users.cancelDeletion': action({
    permission: 'users.write',
    schema: z.object({ uid: uidSchema }),
    run: async ({ uid }) => {
      await db.doc(`deletionRequests/${uid}`).delete();
      return { data: { ok: true }, audit: { target: `user:${uid}`, summary: 'deletion request cancelled' } };
    },
  }),
  'users.executeDeletion': action({
    permission: 'users.delete',
    schema: z.object({ uid: uidSchema, confirmUid: z.string() }),
    run: async ({ uid, confirmUid }, ctx) => {
      if (uid !== confirmUid) throw new PublicError('invalid-argument', 'Type the user id to confirm.');
      if (uid === ctx.uid) throw new PublicError('failed-precondition', 'Use account settings to delete your own account.');
      const req = await db.doc(`deletionRequests/${uid}`).get();
      if (!req.exists) throw new PublicError('failed-precondition', 'Request deletion first; a second step executes it.');
      await deleteUserCompletely(uid, { uid: ctx.uid, role: ctx.role, requestId: ctx.requestId });
      return { data: { ok: true }, audit: { target: `user:${userHash(uid)}`, summary: 'account deletion executed' } };
    },
  }),

  // ── Admin roles (owner only) ────────────────────────────────────────────
  'admins.list': action({
    permission: 'admins.manage',
    schema: z.object({}),
    run: async () => {
      const snap = await db.collection('adminRoles').get();
      return { data: snap.docs.map((d) => ({ uid: d.id, ...d.data() })) };
    },
  }),
  'admins.setRole': action({
    permission: 'admins.manage',
    schema: z.object({ email: z.string().email(), role: z.enum(ADMIN_ROLES).nullable() }),
    run: async ({ email, role }, ctx) => {
      const rec = await auth.getUserByEmail(email);
      if (rec.uid === ctx.uid && role !== 'owner') {
        const owners = (await db.collection('adminRoles').where('role', '==', 'owner').get()).size;
        if (owners <= 1) throw new PublicError('failed-precondition', 'You are the only owner. Add another owner before changing your own role.');
      }
      const claims = { ...(rec.customClaims ?? {}) };
      if (role) claims.role = role;
      else delete claims.role;
      await auth.setCustomUserClaims(rec.uid, claims);
      await auth.revokeRefreshTokens(rec.uid); // forces a fresh token with the new claims
      // Mirror for listing only — authorisation always reads the token claim.
      if (role) await db.doc(`adminRoles/${rec.uid}`).set({ role, email, grantedBy: ctx.uid, grantedAt: new Date().toISOString() });
      else await db.doc(`adminRoles/${rec.uid}`).delete();
      return { data: { ok: true }, audit: { target: `user:${rec.uid}`, summary: `admin role → ${role ?? 'none'}` } };
    },
  }),

  // ── Plans & entitlements ────────────────────────────────────────────────
  'plans.list': action({ permission: 'users.read', schema: z.object({}), run: async () => ({ data: await loadPlans() }) }),
  'plans.upsert': action({
    permission: 'plans.write',
    schema: planSchema,
    run: async (plan) => {
      const ref = db.doc(`plans/${plan.id}`);
      const before = (await ref.get()).data();
      await ref.set(plan);
      clearConfigCache();
      return { data: { ok: true }, audit: { target: `plan:${plan.id}`, summary: diffSummary(before, plan as unknown as Record<string, unknown>) } };
    },
  }),

  // ── Usage, costs and budgets ────────────────────────────────────────────
  'usage.get': action({
    permission: 'usage.read',
    schema: z.object({ days: z.number().int().min(1).max(90).default(30) }),
    run: async ({ days: n }) => {
      const from = days(n - 1).slice(0, 10);
      const daily = await rollups('aiUsageDaily', from);
      const events = await db.collection('aiUsageEvents').where('at', '>=', days(Math.min(n, 7))).orderBy('at', 'desc').limit(2000).get();
      const perUser = new Map<string, number>();
      for (const e of events.docs) {
        const d = e.data();
        if (d.outcome === 'success' || d.outcome === 'fallback') perUser.set(d.userHash, (perUser.get(d.userHash) ?? 0) + 1);
      }
      const budgets = await loadBudgets();
      const month = summariseUsage(await rollups('aiUsageMonthly', new Date().toISOString().slice(0, 7)));
      return {
        data: {
          from,
          series: daily
            .sort((a, b) => String(a.dayKey).localeCompare(String(b.dayKey)))
            .map((d) => ({ dayKey: d.dayKey, ...summariseUsage([d]).total })),
          ...summariseUsage(daily),
          topUsers: [...perUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([hash, requests]) => ({ userHash: hash, requests })),
          topUsersWindowDays: Math.min(n, 7),
          budgets: { settings: budgets, monthSpentUsd: month.total.costUsd },
          note: 'Costs are estimates based on admin-entered per-model prices and provider-reported token counts; they can differ from provider invoices.',
        },
      };
    },
  }),
  'budgets.get': action({ permission: 'usage.read', schema: z.object({}), run: async () => ({ data: await loadBudgets() }) }),
  'budgets.update': action({
    permission: 'budgets.write',
    schema: budgetSettingsSchema,
    run: async (b) => {
      const ref = db.doc('appConfig/budgets');
      const before = (await ref.get()).data();
      await ref.set(b);
      clearConfigCache();
      return { data: { ok: true }, audit: { target: 'budgets', summary: diffSummary(before, b as unknown as Record<string, unknown>) } };
    },
  }),

  // ── Prompts & policies ──────────────────────────────────────────────────
  'prompts.list': action({
    permission: 'prompts.read',
    schema: z.object({ routeKey: z.enum(AI_ROUTE_KEYS) }),
    run: async ({ routeKey }) => {
      const snap = await db.collection('promptVersions').where('routeKey', '==', routeKey).orderBy('version', 'desc').limit(50).get();
      const { DEFAULT_PROMPTS } = await import('../ai/prompts');
      return { data: { versions: snap.docs.map((d) => ({ id: d.id, ...d.data() })), defaultPrompt: DEFAULT_PROMPTS[routeKey], minimumSafetyPolicy: AI_ROUTES[routeKey].minimumSafetyPolicy } };
    },
  }),
  'prompts.createDraft': action({
    permission: 'prompts.write',
    schema: z.object({ routeKey: z.enum(AI_ROUTE_KEYS), systemPrompt: z.string().trim().min(20).max(12000), changeNote: z.string().trim().min(3).max(200) }),
    run: async ({ routeKey, systemPrompt, changeNote }, ctx) => {
      const counter = db.doc(`promptCounters/${routeKey}`);
      const id = await db.runTransaction(async (tx) => {
        const c = await tx.get(counter);
        const version = (c.data()?.latest ?? 0) + 1;
        const ref = db.collection('promptVersions').doc();
        tx.set(counter, { latest: version });
        tx.set(ref, { routeKey, version, status: 'draft', systemPrompt, changeNote, createdBy: ctx.uid, createdAt: new Date().toISOString(), outputSchema: AI_ROUTES[routeKey].requiresStructuredOutput ? 'generatedWorkout' : null });
        return { id: ref.id, version };
      });
      return { data: id, audit: { target: `prompt:${routeKey}`, summary: `draft v${id.version} created: ${changeNote}` } };
    },
  }),
  'prompts.publish': action({
    permission: 'prompts.publish',
    schema: z.object({ versionId: z.string().min(1).max(64), confirm: z.literal(true), rollback: z.boolean().default(false) }),
    run: async ({ versionId, rollback }, ctx) => {
      const ref = db.doc(`promptVersions/${versionId}`);
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new PublicError('not-found', 'Version not found.');
        const v = snap.data()!;
        if (v.status === 'published') throw new PublicError('failed-precondition', 'This version is already published.');
        const current = await tx.get(db.collection('promptVersions').where('routeKey', '==', v.routeKey).where('status', '==', 'published'));
        current.docs.forEach((d) => tx.update(d.ref, { status: 'archived' }));
        tx.update(ref, { status: 'published', publishedBy: ctx.uid, publishedAt: new Date().toISOString() });
        return { routeKey: v.routeKey as AiRouteKey, version: v.version as number, previous: current.docs[0]?.data().version as number | undefined };
      });
      clearConfigCache();
      return {
        data: result,
        audit: { target: `prompt:${result.routeKey}`, summary: `${rollback ? 'rolled back' : 'published'} v${result.version}${result.previous ? ` (was v${result.previous})` : ''}` },
      };
    },
  }),
  'prompts.preview': action({
    permission: 'prompts.write',
    schema: z.object({ routeKey: z.enum(AI_ROUTE_KEYS), systemPrompt: z.string().trim().min(1).max(12000), message: z.string().trim().min(1).max(2000) }),
    run: async ({ routeKey, systemPrompt, message }, ctx) => {
      const screen = screenUserMessage(message);
      if (screen.response) return { data: { text: screen.response, safety: 'red_flag', note: 'Answered by the deterministic safety screen; no model was called.' } };
      const route = await loadRoute(routeKey);
      if (!route?.primary) throw new PublicError('failed-precondition', 'Configure a model route for this feature first.');
      const policy = effectivePolicy(routeKey, route.safetyPolicy);
      const deps = buildAiDeps({ uid: ctx.uid, daily: 1000, monthly: 10000 });
      const res = await runGateway(
        { routeKey, route, requestId: ctx.requestId, userHash: 'admin-preview', system: composeSystemPrompt(policy, systemPrompt, ''), messages: [{ role: 'user', content: message }] },
        deps,
      );
      if (!res.ok) return { data: { text: '', safety: 'unavailable', note: `No provider answered (${res.errorClass}).` } };
      const check = checkModelOutput(res.text, policy);
      return {
        data: {
          text: check.ok ? res.text : SAFE_FALLBACK[policy],
          rawBlocked: !check.ok,
          violations: check.violations,
          safety: check.ok ? 'ok' : 'modified',
          disclaimer: DISCLAIMERS[policy] ?? null,
          provider: res.providerId,
          model: res.model,
          policy,
        },
      };
    },
  }),

  // ── App settings ────────────────────────────────────────────────────────
  'settings.get': action({ permission: 'settings.read', schema: z.object({}), run: async () => ({ data: await loadAppSettings() }) }),
  'settings.update': action({
    permission: 'settings.write',
    schema: appSettingsSchema,
    run: async (s) => {
      const ref = db.doc('appConfig/settings');
      const before = (await ref.get()).data();
      const next = { ...s, updatedAt: new Date().toISOString() };
      await ref.set(next);
      clearConfigCache();
      return { data: { ok: true }, audit: { target: 'settings', summary: diffSummary(before, next, ['announcement', 'maintenance', 'defaultUnits', 'defaultLocale', 'defaultTimeZone', 'supportEmail', 'supportUrl', 'defaultPlanId', 'notificationTemplates', 'onboardingDefaults']) } };
    },
  }),

  // ── Audit log ───────────────────────────────────────────────────────────
  'audit.list': action({
    permission: 'audit.read',
    schema: z.object({ before: z.string().optional(), limit: z.number().int().min(1).max(100).default(50), action: z.string().max(80).optional() }),
    run: async ({ before, limit, action: act }) => {
      let q = db.collection('adminAuditLogs').orderBy('at', 'desc').limit(limit);
      if (act) q = db.collection('adminAuditLogs').where('action', '==', act).orderBy('at', 'desc').limit(limit);
      if (before) q = q.startAfter(before);
      const snap = await q.get();
      return { data: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
    },
  }),

  // ── Session ─────────────────────────────────────────────────────────────
  'session.whoami': action({ permission: 'overview.read', schema: z.object({}), run: async (_i, ctx) => ({ data: { uid: ctx.uid, role: ctx.role, email: ctx.email } }) }),
} satisfies Record<string, ActionDef<z.ZodType>>;

export type AdminAction = keyof typeof ACTIONS;
export const ADMIN_ACTION_NAMES = Object.keys(ACTIONS) as AdminAction[];

const envelope = z.object({ action: z.string().max(60), payload: z.unknown().optional() });

/** Single protected admin endpoint. The action list is fixed — no arbitrary queries or commands. */
export const adminApi = onCall(callableOptions, async (request) => {
  const rid = newRequestId();
  let actionName = 'unknown';
  try {
    const { action: name, payload } = envelope.parse(request.data ?? {});
    actionName = name;
    const def = (ACTIONS as Record<string, ActionDef<z.ZodType>>)[name];
    if (!def) throw new PublicError('invalid-argument', 'Unknown admin action.');
    const ctx = await verifyAdmin(request, def.permission, rid, name);
    const input = def.schema.parse(payload ?? {});
    try {
      const result = await def.run(input, ctx);
      if (result.audit) await audit({ actorUid: ctx.uid, actorRole: ctx.role, action: name, target: result.audit.target, outcome: 'success', summary: result.audit.summary, requestId: rid });
      return result.data;
    } catch (err) {
      if (name.split('.')[1] !== 'list' && !name.endsWith('.get')) {
        await audit({ actorUid: ctx.uid, actorRole: ctx.role, action: name, outcome: 'error', summary: err instanceof PublicError ? err.message : 'internal error', requestId: rid });
      }
      throw err;
    }
  } catch (err) {
    throw toPublicError(err, rid);
  }
});

export { ACTIONS as ADMIN_ACTIONS };
