/**
 * Backend integration tests against the Auth + Firestore emulators.
 * Callables are invoked through firebase-functions' `.run()` with real
 * emulator ID tokens, so the full server-side authorisation path is exercised.
 * Provider HTTP calls are stubbed; nothing leaves the machine.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApi } from '../../functions/src/api/admin';
import { aiChat, getMyConfig, exportMyData, deleteMyAccount, aiGenerateWorkout } from '../../functions/src/api/user';
import { clearConfigCache } from '../../functions/src/services/store';

const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST!;
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST!;
const PROJECT = 'demo-forma';
const auth = getAuth();
const db = getFirestore();

// ── Provider stub ────────────────────────────────────────────────────────
type ProviderReply = { status: number; body: unknown };
let providerReply: (url: string, body: any) => ProviderReply = () => ({ status: 200, body: { choices: [{ message: { content: 'Hello from the stub.' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } } });
let providerCalls: { url: string; body: any; headers: Record<string, string> }[] = [];
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('https://api.openai.com') || url.startsWith('https://generativelanguage.googleapis.com')) {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    providerCalls.push({ url, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = providerReply(url, body);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }
  return realFetch(input as string, init);
});

// ── Helpers ──────────────────────────────────────────────────────────────
async function signIn(email: string, password = 'Passw0rd!long'): Promise<{ uid: string; token: string }> {
  const res = await realFetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const json = (await res.json()) as { localId: string; idToken: string };
  return { uid: json.localId, token: json.idToken };
}

async function makeUser(email: string, role?: string) {
  const user = await auth.createUser({ email, password: 'Passw0rd!long', emailVerified: true });
  if (role) await auth.setCustomUserClaims(user.uid, { role });
  return signIn(email);
}

/** Decodes (not verifies) the token like the callable framework's pre-parsed `auth.token`; the functions verify what they need. */
const decode = (token: string) => JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'));

async function call(fn: { run: (req: any) => any }, who: { uid: string; token: string }, data: unknown) {
  const decoded = decode(who.token);
  return fn.run({ data, auth: { uid: who.uid, token: decoded, rawToken: who.token }, rawRequest: {}, acceptsStreaming: false });
}
const admin = (who: { uid: string; token: string }, action: string, payload: unknown = {}) => call(adminApi, who, { action, payload });
const errCode = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code?: string }) => e.code);

async function resetEmulators() {
  await realFetch(`http://${FS_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await realFetch(`http://${AUTH_HOST}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  clearConfigCache();
}

const openaiProvider = {
  id: 'openai-main', kind: 'openai', displayName: 'OpenAI', enabled: true, priority: 10, timeoutMs: 5000,
  retry: { maxRetries: 0, backoffMs: 0 }, rateLimitPerMinute: 100,
  models: [
    { id: 'gpt-test', capabilities: ['text', 'json'], enabled: true, inputPricePer1M: 1, outputPricePer1M: 2 },
    { id: 'text-only', capabilities: ['text'], enabled: true },
  ],
  defaultModel: 'gpt-test',
};
const coachRoute = (patch: Record<string, unknown> = {}) => ({
  key: 'coachChat', enabled: true, primary: { providerId: 'openai-main', model: 'gpt-test' }, fallbacks: [],
  maxOutputTokens: 400, timeoutMs: 5000, perUserPerHour: 20, perUserPerDay: 100, safetyPolicy: 'health', contextCategories: [], temperature: 0.3, ...patch,
});

async function setupAi(owner: { uid: string; token: string }) {
  await admin(owner, 'providers.upsert', openaiProvider);
  await admin(owner, 'providers.setKey', { providerId: 'openai-main', apiKey: 'sk-test-valid-key-1234', testBeforeSave: false });
  await admin(owner, 'routes.upsert', coachRoute());
}

beforeAll(() => {
  if (!AUTH_HOST || !FS_HOST) throw new Error('Run via `npm run test:integration` so emulators are started.');
});
beforeEach(async () => {
  await resetEmulators();
  providerCalls = [];
  providerReply = () => ({ status: 200, body: { choices: [{ message: { content: 'Hello from the stub.' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } } });
});
afterAll(() => vi.unstubAllGlobals());

// ── Tests ────────────────────────────────────────────────────────────────
describe('admin authorisation (server-side)', () => {
  it('denies signed-in non-admins and audits the attempt', async () => {
    const user = await makeUser('user@example.test');
    expect(await errCode(admin(user, 'overview.get'))).toBe('permission-denied');
    const logs = await db.collection('adminAuditLogs').where('outcome', '==', 'denied').get();
    expect(logs.size).toBe(1);
    expect(logs.docs[0]!.data()).toMatchObject({ actorUid: user.uid, action: 'overview.get' });
  });

  it('ignores admin roles written to Firestore — only server-set claims count', async () => {
    const user = await makeUser('sneaky@example.test');
    await db.doc(`adminRoles/${user.uid}`).set({ role: 'owner' });
    await db.doc(`users/${user.uid}`).set({ role: 'owner', status: 'active', createdAt: new Date().toISOString() });
    expect(await errCode(admin(user, 'providers.list'))).toBe('permission-denied');
  });

  it('enforces least privilege per role', async () => {
    const analyst = await makeUser('analyst@example.test', 'analyst');
    expect((await admin(analyst, 'overview.get')).users.total).toBeGreaterThanOrEqual(0);
    expect(await errCode(admin(analyst, 'flags.upsert', { key: 'aiCoach', enabled: false }))).toBe('permission-denied');
    const support = await makeUser('support@example.test', 'support');
    expect(await errCode(admin(support, 'providers.setKey', { providerId: 'x1', apiKey: 'sk-12345678' }))).toBe('permission-denied');
  });

  it('rejects revoked tokens after a role change', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const adm = await makeUser('admin2@example.test', 'admin');
    // Firebase compares revocation time with token issue time at 1-second granularity.
    await new Promise((r) => setTimeout(r, 1100));
    await admin(owner, 'admins.setRole', { email: 'admin2@example.test', role: null });
    expect(await errCode(admin(adm, 'overview.get'))).toBe('permission-denied');
  });

  it('rejects unknown actions and invalid payloads', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    expect(await errCode(admin(owner, 'db.query', { sql: 'select *' }))).toBe('invalid-argument');
    expect(await errCode(admin(owner, 'flags.upsert', { key: 'notAFlag', enabled: true }))).toBe('invalid-argument');
  });
});

describe('AI providers and credentials', () => {
  it('stores keys only in the secret store and never returns them', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    await admin(owner, 'providers.upsert', openaiProvider);
    const res = await admin(owner, 'providers.setKey', { providerId: 'openai-main', apiKey: 'sk-test-valid-key-ABCD', testBeforeSave: true });
    expect(res.credential).toEqual({ status: 'configured', maskedSuffix: '…ABCD', rotatedAt: expect.any(String) });
    const list = await admin(owner, 'providers.list');
    expect(JSON.stringify(list)).not.toContain('sk-test-valid-key');
    const meta = (await db.doc('aiProviderMetadata/openai-main').get()).data();
    expect(JSON.stringify(meta)).not.toContain('sk-test-valid-key');
    const audits = await db.collection('adminAuditLogs').get();
    expect(JSON.stringify(audits.docs.map((d) => d.data()))).not.toContain('sk-test-valid-key');
  });

  it('refuses to save an invalid key when testing first', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    await admin(owner, 'providers.upsert', openaiProvider);
    providerReply = () => ({ status: 401, body: { error: { message: 'bad key sk-test-wrong-key-0000' } } });
    expect(await errCode(admin(owner, 'providers.setKey', { providerId: 'openai-main', apiKey: 'sk-test-wrong-key-0000' }))).toBe('failed-precondition');
    const meta = (await db.doc('aiProviderMetadata/openai-main').get()).data();
    expect(meta?.status.credential.status).toBe('missing');
    expect(meta?.status.lastHealthCheck.ok).toBe(false);
  });

  it('disabling a compromised key stops AI use, and removal is blocked while routes use it', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    await admin(owner, 'providers.disableKey', { providerId: 'openai-main' });
    const r = await call(aiChat, user, { message: 'hello' });
    expect(r.message.status).toBe('unavailable');
    expect(providerCalls).toHaveLength(0);
    expect(await errCode(admin(owner, 'providers.delete', { providerId: 'openai-main', confirm: 'openai-main' }))).toBe('failed-precondition');
  });

  it('validates routes: capabilities and minimum safety policy', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    await admin(owner, 'providers.upsert', openaiProvider);
    const wg = { ...coachRoute(), key: 'workoutGeneration', safetyPolicy: 'joint', primary: { providerId: 'openai-main', model: 'text-only' } };
    expect(await errCode(admin(owner, 'routes.upsert', wg))).toBe('invalid-argument');
    expect(await errCode(admin(owner, 'routes.upsert', { ...coachRoute(), key: 'kneeEducation', safetyPolicy: 'standard' }))).toBe('invalid-argument');
    expect(await errCode(admin(owner, 'routes.upsert', { ...coachRoute(), primary: { providerId: 'missing', model: 'x' } }))).toBe('invalid-argument');
    await admin(owner, 'routes.upsert', { ...wg, primary: { providerId: 'openai-main', model: 'gpt-test' } });
    const audit = await db.collection('adminAuditLogs').where('action', '==', 'routes.upsert').get();
    expect(audit.docs.map((d) => d.data().outcome)).toContain('success');
  });
});

describe('AI for end users', () => {
  it('chats through the configured route, stores the conversation and records usage', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    const r = await call(aiChat, user, { message: 'How do I start lifting?' });
    expect(r.message).toMatchObject({ content: 'Hello from the stub.', safety: 'ok', status: 'ok' });
    expect(providerCalls[0]!.headers.authorization).toBe('Bearer sk-test-valid-key-1234');
    expect(providerCalls[0]!.body.messages[0].content).toMatch(/Mandatory rules/);
    const msgs = await db.collection(`users/${user.uid}/aiConversations/${r.conversationId}/messages`).get();
    expect(msgs.size).toBe(2);
    const day = (await db.doc(`aiUsageDaily/${new Date().toISOString().slice(0, 10)}`).get()).data()!;
    expect(day.outcomes.success).toBe(1);
    expect(day.costMicroUsd).toBe(200);
    const events = await db.collection('aiUsageEvents').get();
    expect(JSON.stringify(events.docs.map((d) => d.data()))).not.toContain(user.uid);
  });

  it('kill switch disables the feature server-side', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    await admin(owner, 'flags.upsert', { key: 'aiCoach', enabled: false, message: 'Coach paused' });
    const r = await call(aiChat, user, { message: 'hi' });
    expect(r.message).toMatchObject({ status: 'disabled', content: 'Coach paused' });
    expect(providerCalls).toHaveLength(0);
    const cfg = await call(getMyConfig, user, {});
    expect(cfg.features.aiCoach.enabled).toBe(false);
  });

  it('enforces per-user rate limits and plan quotas', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    await admin(owner, 'routes.upsert', coachRoute({ perUserPerHour: 2 }));
    await call(aiChat, user, { message: 'one' });
    await call(aiChat, user, { message: 'two' });
    expect((await call(aiChat, user, { message: 'three' })).message.status).toBe('rate_limited');

    const user2 = await makeUser('user2@example.test');
    await admin(owner, 'routes.upsert', coachRoute());
    await admin(owner, 'users.setEntitlement', { uid: user2.uid, planId: 'free', status: 'active', featureOverrides: {}, aiDailyOverride: 1 });
    await call(aiChat, user2, { message: 'one' });
    expect((await call(aiChat, user2, { message: 'two' })).message.status).toBe('quota');
  });

  it('blocks when the global budget is spent', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    await admin(owner, 'budgets.update', { globalDailyUsd: 0.0001, warnAtPercent: 50, onExceeded: 'block' });
    await call(aiChat, user, { message: 'first' }); // costs 200 micro-USD > 100 budget
    expect((await call(aiChat, user, { message: 'second' })).message.status).toBe('budget');
    expect((await db.collection('budgetAlerts').get()).size).toBeGreaterThan(0);
  });

  it('replaces unsafe output and answers red flags without a model', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await setupAi(owner);
    providerReply = () => ({ status: 200, body: { choices: [{ message: { content: 'You probably have a meniscus tear. Push through the pain.' } }] } });
    const r = await call(aiChat, user, { message: 'my knee aches' });
    expect(r.message.safety).toBe('modified');
    expect(r.message.content).not.toMatch(/meniscus/);
    providerCalls = [];
    const flag = await call(aiChat, user, { message: 'My knee locked and won’t straighten' });
    expect(flag.message.safety).toBe('red_flag');
    expect(providerCalls).toHaveLength(0);
  });

  it('falls back to a template plan when AI drafting is unavailable, honouring clinician instructions', async () => {
    const user = await makeUser('user@example.test');
    await db.doc(`users/${user.uid}/profile/main`).set({ displayName: 'A', equipment: ['dumbbell'], experience: 'beginner', sessionMinutes: 30, consent: { healthDetails: true, aiContext: [] }, updatedAt: '' });
    await db.doc(`users/${user.uid}/clinicianInstructions/c1`).set({ id: 'c1', active: true, instructions: 'No lunges', avoidExerciseIds: ['reverse-lunge', 'step-up'], avoidTags: [], createdAt: '', updatedAt: '', revision: 0, source: 'manual' });
    const r = await call(aiGenerateWorkout, user, { request: 'home plan' });
    expect(r.source).toBe('template');
    const ids = r.plan.days.flatMap((d: { exercises: { exerciseId: string }[] }) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('reverse-lunge');
    expect(ids).not.toContain('step-up');
  });
});

describe('prompts: versioning, publish and rollback', () => {
  it('publishes and rolls back with an audit trail', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const v1 = await admin(owner, 'prompts.createDraft', { routeKey: 'coachChat', systemPrompt: 'Version one guidance text for the coach.', changeNote: 'first version' });
    expect(await errCode(admin(owner, 'prompts.publish', { versionId: v1.id, confirm: false }))).toBe('invalid-argument');
    await admin(owner, 'prompts.publish', { versionId: v1.id, confirm: true });
    const v2 = await admin(owner, 'prompts.createDraft', { routeKey: 'coachChat', systemPrompt: 'Version two guidance text for the coach.', changeNote: 'second version' });
    await admin(owner, 'prompts.publish', { versionId: v2.id, confirm: true });
    await admin(owner, 'prompts.publish', { versionId: v1.id, confirm: true, rollback: true });
    const list = await admin(owner, 'prompts.list', { routeKey: 'coachChat' });
    const status = Object.fromEntries(list.versions.map((v: { version: number; status: string }) => [v.version, v.status]));
    expect(status).toEqual({ 1: 'published', 2: 'archived' });
    const audit = (await db.collection('adminAuditLogs').where('action', '==', 'prompts.publish').get()).docs.map((d) => d.data().summary);
    expect(audit.some((s: string) => s.startsWith('rolled back v1'))).toBe(true);
  });
});

describe('user management and privacy', () => {
  it('suspension blocks app use but not data export; reactivation restores it', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await call(getMyConfig, user, {});
    await admin(owner, 'users.setStatus', { uid: user.uid, status: 'suspended', reason: 'support test' });
    expect(await errCode(call(getMyConfig, user, {}))).toBe('permission-denied');
    expect(await errCode(call(exportMyData, user, {}))).toBe('ok');
    expect((await auth.getUser(user.uid)).disabled).toBe(true);
    await admin(owner, 'users.setStatus', { uid: user.uid, status: 'active', reason: 'resolved' });
    expect(await errCode(call(getMyConfig, user, {}))).toBe('ok');
  });

  it('entitlement overrides change server-evaluated features', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    expect((await call(getMyConfig, user, {})).features.premiumFeatures.enabled).toBe(false);
    await admin(owner, 'users.setEntitlement', { uid: user.uid, planId: 'free', status: 'active', featureOverrides: { premiumFeatures: true } });
    clearConfigCache();
    expect((await call(getMyConfig, user, {})).features.premiumFeatures.enabled).toBe(true);
  });

  it('exports the user’s own data only', async () => {
    const user = await makeUser('user@example.test');
    const other = await makeUser('other@example.test');
    await db.doc(`users/${user.uid}/hydrationLogs/h1`).set({ id: 'h1', ml: 250 });
    await db.doc(`users/${other.uid}/hydrationLogs/h9`).set({ id: 'h9', ml: 999 });
    const out = await call(exportMyData, user, {});
    expect(out.hydrationLogs).toEqual([{ id: 'h1', ml: 250 }]);
    expect(JSON.stringify(out)).not.toContain('"h9"');
  });

  it('self-deletion requires a recent sign-in and removes everything', async () => {
    const user = await makeUser('user@example.test');
    await call(getMyConfig, user, {});
    await db.doc(`users/${user.uid}/workoutSessions/s1`).set({ id: 's1' });
    const decoded = decode(user.token);
    const stale = { ...decoded, auth_time: Math.floor(Date.now() / 1000) - 3600 };
    await expect(deleteMyAccount.run({ data: { confirm: 'DELETE' }, auth: { uid: user.uid, token: stale, rawToken: user.token }, rawRequest: {}, acceptsStreaming: false } as never)).rejects.toMatchObject({ code: 'failed-precondition' });
    await call(deleteMyAccount, user, { confirm: 'DELETE' });
    expect((await db.doc(`users/${user.uid}/workoutSessions/s1`).get()).exists).toBe(false);
    expect((await db.doc(`userEntitlements/${user.uid}`).get()).exists).toBe(false);
    expect(await errCode(auth.getUser(user.uid))).toBe('auth/user-not-found');
  });

  it('admin deletion is two-step and owner-only', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const adm = await makeUser('admin@example.test', 'admin');
    const user = await makeUser('user@example.test');
    await call(getMyConfig, user, {});
    expect(await errCode(admin(owner, 'users.executeDeletion', { uid: user.uid, confirmUid: user.uid }))).toBe('failed-precondition');
    await admin(adm, 'users.requestDeletion', { uid: user.uid, reason: 'user emailed support' });
    expect(await errCode(admin(adm, 'users.executeDeletion', { uid: user.uid, confirmUid: user.uid }))).toBe('permission-denied');
    await admin(owner, 'users.executeDeletion', { uid: user.uid, confirmUid: user.uid });
    expect(await errCode(auth.getUser(user.uid))).toBe('auth/user-not-found');
  });

  it('overview reports real counts and lists unavailable metrics honestly', async () => {
    const owner = await makeUser('owner@example.test', 'owner');
    const user = await makeUser('user@example.test');
    await call(getMyConfig, user, {});
    await call(getMyConfig, owner, {});
    const o = await admin(owner, 'overview.get');
    expect(o.users.total).toBe(2);
    expect(o.users.new7).toBe(2);
    expect(o.unavailable.length).toBeGreaterThan(0);
  });
});
