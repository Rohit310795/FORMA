import { describe, expect, it } from 'vitest';
import {
  evaluateFeature, DEFAULT_PLANS, resolveConflict, coalesceOutbox, retryDelayMs, permittedContext, estimateCostMicroUsd,
  buildPlanFromTemplate, EXERCISES, filterExercises, hasPermission, rolloutBucket, workoutPlanSchema, type Entitlement,
} from '../src';

const ent = (patch: Partial<Entitlement> = {}): Entitlement => ({ planId: 'free', status: 'active', source: 'default', featureOverrides: {}, updatedAt: '', ...patch });

describe('feature flags', () => {
  const free = DEFAULT_PLANS[0]!;
  it('kill switch beats a per-user override', () => {
    const d = evaluateFeature('aiCoach', { uid: 'u', flags: { aiCoach: { key: 'aiCoach', enabled: false, rolloutPercent: 100, plans: [], platforms: [] } }, entitlement: ent({ featureOverrides: { aiCoach: true } }), plan: free });
    expect(d).toMatchObject({ enabled: false, reason: 'flag_off' });
  });
  it('overrides can grant or revoke', () => {
    expect(evaluateFeature('premiumFeatures', { uid: 'u', flags: {}, entitlement: ent({ featureOverrides: { premiumFeatures: true } }), plan: free }).enabled).toBe(true);
    expect(evaluateFeature('aiCoach', { uid: 'u', flags: {}, entitlement: ent({ featureOverrides: { aiCoach: false } }), plan: free }).enabled).toBe(false);
  });
  it('plans gate premium features', () => {
    expect(evaluateFeature('premiumFeatures', { uid: 'u', flags: {}, entitlement: ent(), plan: free }).reason).toBe('plan');
    expect(evaluateFeature('premiumFeatures', { uid: 'u', flags: {}, entitlement: ent({ planId: 'pro' }), plan: DEFAULT_PLANS[1] }).enabled).toBe(true);
  });
  it('staged rollout is deterministic and proportional', () => {
    const flags = { aiCoach: { key: 'aiCoach' as const, enabled: true, rolloutPercent: 30, plans: [], platforms: [] } };
    let on = 0;
    for (let i = 0; i < 2000; i++) if (evaluateFeature('aiCoach', { uid: `user${i}`, flags, plan: free }).enabled) on++;
    expect(on / 2000).toBeGreaterThan(0.25);
    expect(on / 2000).toBeLessThan(0.35);
    expect(rolloutBucket('a', 'b')).toBe(rolloutBucket('a', 'b'));
  });
});

describe('offline sync', () => {
  it('higher revision wins; completed sessions are never replaced by stale in-progress copies', () => {
    expect(resolveConflict({ id: 'x', revision: 2, updatedAt: '1' }, { id: 'x', revision: 1, updatedAt: '9' }).winner).toBe('local');
    expect(resolveConflict({ id: 'x', revision: 5, updatedAt: '9', status: 'in_progress' }, { id: 'x', revision: 1, updatedAt: '1', status: 'completed' }).winner).toBe('remote');
    expect(resolveConflict({ id: 'x', revision: 1, updatedAt: '2' }, { id: 'x', revision: 1, updatedAt: '1' }).winner).toBe('local');
  });
  it('coalesces duplicate queued writes to one per document', () => {
    const items = coalesceOutbox([
      { collection: 'workoutSessions', id: 'a', op: 'upsert', data: { v: 1 }, enqueuedAt: '1', attempts: 2 },
      { collection: 'workoutSessions', id: 'a', op: 'upsert', data: { v: 2 }, enqueuedAt: '2', attempts: 0 },
      { collection: 'hydrationLogs', id: 'a', op: 'upsert', data: {}, enqueuedAt: '3', attempts: 0 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ data: { v: 2 }, attempts: 2 });
    expect(retryDelayMs(20)).toBe(256000);
  });
});

describe('AI context minimisation', () => {
  it('intersects route allow-list, config, consent and per-request choice', () => {
    expect(permittedContext({ routeKey: 'kneeEducation', userConsent: ['profile', 'nutrition', 'discomfort'], hasHealthConsent: true })).toEqual(['profile', 'discomfort']);
    expect(permittedContext({ routeKey: 'kneeEducation', userConsent: ['profile', 'discomfort'], hasHealthConsent: false })).toEqual(['profile']);
    expect(permittedContext({ routeKey: 'coachChat', userConsent: ['profile', 'goals', 'sleep'], requestShare: ['goals'], hasHealthConsent: true })).toEqual(['goals']);
    expect(permittedContext({ routeKey: 'coachChat', userConsent: [], hasHealthConsent: true })).toEqual([]);
    expect(permittedContext({ routeKey: 'coachChat', routeConfigCategories: ['goals'], userConsent: ['profile', 'goals'], hasHealthConsent: true })).toEqual(['goals']);
  });
  it('estimates cost from admin-entered prices only', () => {
    expect(estimateCostMicroUsd(1000, 500, 2, 8)).toBe(6000);
    expect(estimateCostMicroUsd(1000, 500)).toBeUndefined();
  });
});

describe('plan builder', () => {
  it('builds a valid, conservative plan respecting equipment and the safety filter', () => {
    const { allowed } = filterExercises(EXERCISES, { today: '2026-10-21', avoidedExerciseIds: ['push-up'] });
    const plan = buildPlanFromTemplate({ split: 'home', equipment: ['dumbbell', 'band'], experience: 'beginner', sessionMinutes: 30, allowed, now: '2026-10-21T00:00:00Z', id: 'p1' });
    expect(() => workoutPlanSchema.parse(plan)).not.toThrow();
    const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain('push-up');
    expect(ids).not.toContain('barbell-bench-press');
    plan.days.forEach((d) => {
      expect(d.exercises.length).toBeLessThanOrEqual(3);
      d.exercises.forEach((e) => expect(e.sets).toBeLessThanOrEqual(2));
    });
  });
  it('maps training days onto plan days', () => {
    const plan = buildPlanFromTemplate({ split: 'ppl', equipment: ['barbell', 'dumbbell', 'cable', 'bench', 'machine'], experience: 'intermediate', sessionMinutes: 60, trainingDays: [2, 4, 6], allowed: EXERCISES, now: '', id: 'p2' });
    expect(plan.days.map((d) => d.weekday)).toEqual([2, 4, 6]);
    expect(plan.days[0]!.exercises[0]!.exerciseId).toBe('barbell-bench-press');
  });
});

describe('admin permissions', () => {
  it('enforces least privilege', () => {
    expect(hasPermission('owner', 'admins.manage')).toBe(true);
    expect(hasPermission('admin', 'admins.manage')).toBe(false);
    expect(hasPermission('support', 'providers.secrets')).toBe(false);
    expect(hasPermission('analyst', 'flags.write')).toBe(false);
    expect(hasPermission(undefined, 'overview.read')).toBe(false);
    expect(hasPermission('superuser', 'overview.read')).toBe(false);
  });
});
