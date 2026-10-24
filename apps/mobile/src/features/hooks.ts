import { useMemo } from 'react';
import {
  dayKey,
  isoWeekday,
  EXERCISE_MAP,
  previousPerformance,
  type NutritionTargets,
  type PlanDay,
  type WorkoutPlan,
  type WorkoutSession,
  type LoggedSet,
} from '@forma/shared';
import { useCollection, useUserDoc } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { newId, nowIso } from '@/lib/ids';

export function useToday() {
  const { profile } = useProfile();
  return dayKey(new Date(), profile?.timeZone);
}

export const useSessions = () => useCollection<WorkoutSession>('workoutSessions', { orderBy: 'startedAt', limit: 300 });
export const usePlans = () => useCollection<WorkoutPlan>('workoutPlans', { orderBy: 'updatedAt' });
export const useTargets = () => useUserDoc<NutritionTargets>('settings', 'nutritionTargets');

export function useActivePlan() {
  const { items, loading } = usePlans();
  const active = items.find((p) => p.active && !p.archivedAt);
  return { plan: active, plans: items.filter((p) => !p.archivedAt), loading };
}

export function planDayFor(plan: WorkoutPlan | undefined, today: string): PlanDay | undefined {
  if (!plan) return undefined;
  return plan.days.find((d) => d.weekday === isoWeekday(today));
}

/** The next scheduled plan day from today (inclusive), for "up next" cards. */
export function nextPlanDay(plan: WorkoutPlan | undefined, today: string): { day: PlanDay; inDays: number } | undefined {
  if (!plan) return undefined;
  const wd = isoWeekday(today);
  let best: { day: PlanDay; inDays: number } | undefined;
  for (const d of plan.days) {
    if (!d.weekday) continue;
    const inDays = (d.weekday - wd + 7) % 7;
    if (!best || inDays < best.inDays) best = { day: d, inDays };
  }
  return best ?? (plan.days[0] ? { day: plan.days[0], inDays: 0 } : undefined);
}

/** Builds a new in-progress session from a plan day, pre-filling last time's loads. */
export function sessionFromPlanDay(plan: WorkoutPlan | undefined, day: PlanDay | undefined, history: WorkoutSession[], today: string, name?: string): WorkoutSession {
  const now = nowIso();
  const id = newId();
  return {
    id,
    dayKey: today,
    planId: plan?.id,
    planVersion: plan?.version,
    planDayKey: day?.key,
    name: name ?? day?.name ?? 'Quick workout',
    status: 'in_progress',
    startedAt: now,
    pausedMs: 0,
    createdAt: now,
    updatedAt: now,
    revision: 0,
    source: 'manual',
    exercises: (day?.exercises ?? []).map((pe) => {
      const prev = previousPerformance(history, pe.exerciseId);
      const ex = EXERCISE_MAP.get(pe.exerciseId);
      const lastWeight = prev?.sets.find((s) => s.weightKg !== undefined)?.weightKg;
      const working: LoggedSet[] = Array.from({ length: pe.sets }, (_, i) => ({
        kind: 'working',
        reps: ex?.timed ? undefined : (prev?.sets[i]?.reps ?? pe.repsMax),
        durationSec: ex?.timed ? (pe.durationSec ?? 30) : undefined,
        weightKg: prev?.sets[i]?.weightKg ?? lastWeight,
        completed: false,
      }));
      const warmups: LoggedSet[] = Array.from({ length: pe.warmupSets ?? 0 }, () => ({
        kind: 'warmup',
        reps: 8,
        weightKg: lastWeight ? Math.round(lastWeight * 0.5 * 2) / 2 : undefined,
        completed: false,
      }));
      return { key: pe.key, exerciseId: pe.exerciseId, restSec: pe.restSec, sets: [...warmups, ...working] };
    }),
  };
}

export function useWeekStrip(sessions: WorkoutSession[], today: string) {
  return useMemo(() => {
    const wd = isoWeekday(today);
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.UTC(y, m - 1, d - (wd - 1) + i));
      const key = date.toISOString().slice(0, 10);
      return { key, label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]!, date: date.getUTCDate(), trained: sessions.some((s) => s.status === 'completed' && s.dayKey === key), isToday: key === today };
    });
  }, [sessions, today]);
}
