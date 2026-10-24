import { z } from 'zod';
import {
  AI_CONTEXT_CATEGORIES,
  EXERCISES,
  EXERCISE_MAP,
  buildPlanFromTemplate,
  chatRequestSchema,
  dayKey,
  filterExercises,
  SPLIT_TYPES,
  type ClinicianInstruction,
  type DiscomfortLog,
  type GeneratedWorkout,
  type WorkoutPlan,
  type AiContextCategory,
} from '@forma/shared';
import { userCallable } from '../lib/callable';
import { db, FieldValue } from '../lib/firebase';
import { newId, userHash } from '../lib/ids';
import { PublicError } from '../lib/errors';
import { handleAiRequest, type AiOutcome } from '../ai/service';
import { buildAiDeps } from '../ai/deps';
import { featuresFor, touchActivity } from '../services/users';
import { loadAppSettings } from '../services/store';
import { quotaUsage } from '../services/limits';
import { exportUserData, deleteUserCompletely } from '../services/accounts';
import { logger } from '../lib/logger';

/** App bootstrap: evaluated features, plan, quotas and public settings — all decided here, not in the app. */
export const getMyConfig = userCallable(z.object({ platform: z.enum(['ios', 'android', 'web']).optional() }), async ({ uid, input, account }) => {
  await touchActivity(uid, account.user);
  const [{ decisions, plan }, settings, usage] = await Promise.all([featuresFor(uid, account.entitlement, input.platform), loadAppSettings(), quotaUsage(userHash(uid))]);
  return {
    features: decisions,
    entitlement: { planId: account.entitlement.planId, planName: plan?.name ?? account.entitlement.planId, status: account.entitlement.status, billing: plan?.billing ?? 'test_mode' },
    ai: { usedToday: usage.today, usedThisMonth: usage.month, dailyLimit: account.entitlement.aiDailyOverride ?? plan?.aiDailyRequests ?? 0, monthlyLimit: plan?.aiMonthlyRequests ?? 0 },
    settings: {
      announcement: settings.announcement?.active ? settings.announcement : undefined,
      maintenance: settings.maintenance,
      defaultUnits: settings.defaultUnits,
      defaultLocale: settings.defaultLocale,
      defaultTimeZone: settings.defaultTimeZone,
      supportEmail: settings.supportEmail,
      supportUrl: settings.supportUrl,
      onboardingDefaults: settings.onboardingDefaults,
      notificationTemplates: settings.notificationTemplates,
    },
  };
});

async function userAiProfile(uid: string) {
  const p = (await db.doc(`users/${uid}/profile/main`).get()).data();
  const consent = (p?.consent ?? {}) as { aiContext?: AiContextCategory[]; healthDetails?: boolean };
  const valid = new Set<string>(AI_CONTEXT_CATEGORIES);
  return { profile: p, userConsent: (consent.aiContext ?? []).filter((c) => valid.has(c)), hasHealthConsent: consent.healthDetails === true };
}

async function quotaFor(account: { entitlement: { planId: string; aiDailyOverride?: number } }, plan: { aiDailyRequests: number; aiMonthlyRequests: number } | undefined) {
  return { daily: account.entitlement.aiDailyOverride ?? plan?.aiDailyRequests ?? 0, monthly: plan?.aiMonthlyRequests ?? 0 };
}

/** AI Coach chat and one-off AI insights. Conversations are stored server-side under the user. */
export const aiChat = userCallable(chatRequestSchema, async ({ uid, input, requestId, account, signal }) => {
  const { userConsent, hasHealthConsent } = await userAiProfile(uid);
  const { plan } = await featuresFor(uid, account.entitlement);
  const limits = await quotaFor(account, plan);
  const convId = input.conversationId ?? newId();
  const convRef = db.doc(`users/${uid}/aiConversations/${convId}`);
  const conv = await convRef.get();
  if (input.conversationId && !conv.exists) throw new PublicError('not-found', 'Conversation not found.');
  const history = conv.exists
    ? (await convRef.collection('messages').orderBy('createdAt', 'desc').limit(10).get()).docs
        .map((d) => d.data())
        .reverse()
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.safety === 'ok'))
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 4000) }))
    : [];

  const outcome = await handleAiRequest(
    { uid, userHash: userHash(uid), requestId, routeKey: input.routeKey, message: input.message, history, userConsent, hasHealthConsent, shareContext: input.shareContext, signal },
    buildAiDeps({ uid, daily: limits.daily, monthly: limits.monthly }),
  );

  const now = new Date();
  const userMsg = { role: 'user', content: input.message, createdAt: now.toISOString() };
  const assistantMsg = {
    role: 'assistant',
    content: outcome.text,
    createdAt: new Date(now.getTime() + 1).toISOString(),
    safety: outcome.safety,
    disclaimers: outcome.disclaimers,
    degraded: outcome.degraded,
    status: outcome.status,
    contextUsed: outcome.contextUsed,
  };
  const batch = db.batch();
  if (!conv.exists) batch.set(convRef, { routeKey: input.routeKey, title: input.message.slice(0, 60), createdAt: now.toISOString(), updatedAt: now.toISOString(), messageCount: 0 });
  const userRef = convRef.collection('messages').doc();
  const asstRef = convRef.collection('messages').doc();
  batch.set(userRef, userMsg);
  batch.set(asstRef, assistantMsg);
  batch.set(convRef, { updatedAt: now.toISOString(), messageCount: FieldValue.increment(2) }, { merge: true });
  await batch.commit();
  logger.info('ai_chat', { requestId, route: input.routeKey, status: outcome.status, safety: outcome.safety, provider: outcome.providerId });
  return { conversationId: convId, message: { id: asstRef.id, ...assistantMsg } };
});

export const aiFeedback = userCallable(
  z.object({ conversationId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/), messageId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/), value: z.enum(['up', 'down']) }),
  async ({ uid, input }) => {
    const ref = db.doc(`users/${uid}/aiConversations/${input.conversationId}/messages/${input.messageId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.role !== 'assistant') throw new PublicError('not-found', 'Message not found.');
    await ref.update({ feedback: input.value });
    const day = new Date().toISOString().slice(0, 10);
    await db.doc(`aiUsageDaily/${day}`).set({ feedback: { [input.value]: FieldValue.increment(1) } }, { merge: true });
    return { ok: true };
  },
);

/** Drafts a plan with AI, then re-applies the deterministic safety filter to whatever came back. */
export const aiGenerateWorkout = userCallable(
  z.object({ request: z.string().trim().max(500).default(''), split: z.enum(SPLIT_TYPES).optional(), sessionMinutes: z.number().int().min(10).max(180).optional() }),
  async ({ uid, input, requestId, account, signal }): Promise<{ status: AiOutcome['status']; message: string; plan?: WorkoutPlan; source: 'ai' | 'template'; excluded: number }> => {
    const { profile, userConsent, hasHealthConsent } = await userAiProfile(uid);
    const today = dayKey(new Date(), profile?.timeZone);
    const [logs, instr] = await Promise.all([
      db.collection(`users/${uid}/discomfortLogs`).orderBy('dayKey', 'desc').limit(20).get(),
      db.collection(`users/${uid}/clinicianInstructions`).where('active', '==', true).get(),
    ]);
    const filter = filterExercises(EXERCISES, {
      today,
      discomfortLogs: logs.docs.map((d) => d.data() as DiscomfortLog),
      clinicianInstructions: instr.docs.map((d) => d.data() as ClinicianInstruction),
      avoidedExerciseIds: profile?.avoidedExerciseIds ?? [],
    });
    const equipment = new Set<string>([...(profile?.equipment ?? []), 'bodyweight']);
    const allowed = filter.allowed.filter((e) => e.equipment.some((q) => equipment.has(q)));
    const allowedIds = new Set(allowed.map((e) => e.id));
    const sessionMinutes = input.sessionMinutes ?? profile?.sessionMinutes ?? 45;
    const now = new Date().toISOString();
    const templatePlan = () =>
      buildPlanFromTemplate({
        split: input.split ?? (profile?.experience === 'new' || profile?.experience === 'beginner' ? 'beginner' : 'full_body'),
        equipment: [...equipment] as never,
        experience: profile?.experience ?? 'beginner',
        sessionMinutes,
        trainingDays: profile?.trainingDays,
        allowed,
        now,
        id: newId(),
      });

    const { plan: entPlan } = await featuresFor(uid, account.entitlement);
    const limits = await quotaFor(account, entPlan);
    const serverContext = [
      `Allowed exercise ids (use ONLY these): ${allowed.map((e) => `${e.id} (${e.name})`).join('; ')}`,
      `Session length: ${sessionMinutes} minutes. Days per week: ${profile?.trainingDays?.length || 3}.`,
      filter.assessment && filter.assessment.level !== 'ok' ? `Current discomfort safety level: ${filter.assessment.level}. Keep it gentle.` : '',
    ].filter(Boolean).join('\n');
    const outcome = await handleAiRequest(
      {
        uid, userHash: userHash(uid), requestId, routeKey: 'workoutGeneration', message: input.request || 'Create a plan for my goals.',
        userConsent, hasHealthConsent, outputSchema: 'generatedWorkout', serverContext, signal,
      },
      buildAiDeps({ uid, daily: limits.daily, monthly: limits.monthly }),
    );
    if (outcome.status !== 'ok' || !outcome.structured || outcome.safety !== 'ok') {
      return { status: outcome.status, message: `${outcome.text || 'AI drafting is unavailable.'} Here is a template-based plan instead.`, plan: templatePlan(), source: 'template', excluded: filter.excluded.length };
    }
    const draft = outcome.structured as GeneratedWorkout;
    const plan: WorkoutPlan = {
      id: newId(),
      name: draft.name,
      split: input.split ?? 'custom',
      description: draft.summary,
      sessionMinutes,
      equipment: [...equipment] as never,
      days: draft.days
        .map((d, di) => ({
          key: `day${di}`,
          name: d.name,
          focus: d.focus,
          weekday: profile?.trainingDays?.[di],
          warmupRoutineId: 'general-warmup',
          cooldownRoutineId: 'post-workout-cooldown',
          exercises: d.exercises
            .filter((e) => allowedIds.has(e.exerciseId)) // independent of the model: unknown or unsafe ids are dropped
            .slice(0, 8)
            .map((e, ei) => ({
              key: `d${di}e${ei}`,
              exerciseId: e.exerciseId,
              sets: Math.min(e.sets, profile?.experience === 'new' || profile?.experience === 'beginner' ? 3 : 5),
              repsMin: Math.min(e.repsMin, e.repsMax),
              repsMax: Math.max(e.repsMin, e.repsMax),
              durationSec: EXERCISE_MAP.get(e.exerciseId)?.timed ? 30 : undefined,
              restSec: e.restSec,
              warmupSets: 0,
              note: e.note || undefined,
            })),
        }))
        .filter((d) => d.exercises.length > 0),
      active: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      revision: 0,
      source: 'ai_draft',
    };
    if (!plan.days.length) return { status: 'unavailable', message: 'The AI draft had no usable exercises. Here is a template-based plan instead.', plan: templatePlan(), source: 'template', excluded: filter.excluded.length };
    return { status: 'ok', message: draft.summary, plan, source: 'ai', excluded: filter.excluded.length };
  },
);

export const exportMyData = userCallable(z.object({}), async ({ uid }) => exportUserData(uid), { allowSuspended: true });

/** Self-service deletion. Requires a recent sign-in so a stolen idle session can't wipe an account. */
export const deleteMyAccount = userCallable(z.object({ confirm: z.literal('DELETE') }), async ({ uid, requestId, request }) => {
  const authTime = Number(request.auth?.token.auth_time ?? 0) * 1000;
  if (Date.now() - authTime > 10 * 60_000) throw new PublicError('failed-precondition', 'Please sign in again to confirm account deletion.', { reason: 'recent_login_required' });
  await deleteUserCompletely(uid, { uid, requestId });
  return { deleted: true };
}, { allowSuspended: true });
