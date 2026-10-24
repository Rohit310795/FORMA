import type { Muscle, WorkoutSession, Exercise } from '../schemas/workout';
import { addDays, daysBetween, weekStart } from '../dates';

/** Epley estimated 1RM. Only meaningful for sets of ~1–12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number | undefined {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return undefined;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

const workingCompleted = (s: WorkoutSession) =>
  s.exercises.flatMap((e) => e.sets.filter((set) => set.completed && set.kind === 'working').map((set) => ({ e, set })));

/** Volume load = Σ reps × kg for completed working sets. */
export function sessionVolumeKg(session: WorkoutSession): number {
  return Math.round(workingCompleted(session).reduce((sum, { set }) => sum + (set.reps ?? 0) * (set.weightKg ?? 0), 0));
}

export function completedSetCount(session: WorkoutSession): number {
  return workingCompleted(session).length;
}

/** Active duration in minutes, excluding pauses. */
export function sessionDurationMin(session: WorkoutSession): number | undefined {
  if (!session.endedAt) return undefined;
  const ms = Date.parse(session.endedAt) - Date.parse(session.startedAt) - (session.pausedMs ?? 0);
  return Math.max(0, Math.round(ms / 60000));
}

export interface PersonalRecord {
  exerciseId: string;
  kind: 'heaviest' | 'e1rm' | 'reps_at_weight';
  value: number;
  weightKg?: number;
  reps?: number;
  sessionId: string;
  dayKey: string;
}

/** Personal records computed only from completed sessions' completed working sets. */
export function personalRecords(sessions: WorkoutSession[]): Map<string, { heaviest?: PersonalRecord; e1rm?: PersonalRecord }> {
  const out = new Map<string, { heaviest?: PersonalRecord; e1rm?: PersonalRecord }>();
  const ordered = sessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const s of ordered) {
    for (const { e, set } of workingCompleted(s)) {
      if (!set.weightKg || !set.reps) continue;
      const rec = out.get(e.exerciseId) ?? {};
      if (!rec.heaviest || set.weightKg > rec.heaviest.value) {
        rec.heaviest = { exerciseId: e.exerciseId, kind: 'heaviest', value: set.weightKg, weightKg: set.weightKg, reps: set.reps, sessionId: s.id, dayKey: s.dayKey };
      }
      const e1 = estimateOneRepMax(set.weightKg, set.reps);
      if (e1 && (!rec.e1rm || e1 > rec.e1rm.value)) {
        rec.e1rm = { exerciseId: e.exerciseId, kind: 'e1rm', value: e1, weightKg: set.weightKg, reps: set.reps, sessionId: s.id, dayKey: s.dayKey };
      }
      out.set(e.exerciseId, rec);
    }
  }
  return out;
}

/** Records newly set by `session` compared with prior history. */
export function newRecordsInSession(session: WorkoutSession, history: WorkoutSession[]): PersonalRecord[] {
  const before = personalRecords(history.filter((h) => h.id !== session.id));
  const after = personalRecords([...history.filter((h) => h.id !== session.id), session]);
  const out: PersonalRecord[] = [];
  for (const [exerciseId, rec] of after) {
    const prev = before.get(exerciseId);
    if (rec.heaviest?.sessionId === session.id && (!prev?.heaviest || rec.heaviest.value > prev.heaviest.value)) out.push(rec.heaviest);
    if (rec.e1rm?.sessionId === session.id && (!prev?.e1rm || rec.e1rm.value > prev.e1rm.value)) out.push(rec.e1rm);
  }
  return out;
}

export interface ConsistencySummary {
  /** Completed sessions per ISO week, oldest first. */
  weeks: { weekStart: string; sessions: number }[];
  currentStreakWeeks: number;
  sessionsLast7: number;
  sessionsLast28: number;
}

/** A week "counts" toward the streak when it has at least `minPerWeek` completed sessions. */
export function consistency(sessions: WorkoutSession[], today: string, weeks = 8, minPerWeek = 1): ConsistencySummary {
  const completed = sessions.filter((s) => s.status === 'completed');
  const thisWeek = weekStart(today);
  const buckets = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(thisWeek, -7 * (weeks - 1 - i)), sessions: 0 }));
  for (const s of completed) {
    const ws = weekStart(s.dayKey);
    const b = buckets.find((x) => x.weekStart === ws);
    if (b) b.sessions += 1;
  }
  let streak = 0;
  for (let i = buckets.length - 1; i >= 0; i--) {
    const b = buckets[i]!;
    // The current week doesn't break a streak until it's over.
    if (b.sessions >= minPerWeek) streak += 1;
    else if (i !== buckets.length - 1) break;
  }
  const within = (n: number) => completed.filter((s) => { const d = daysBetween(s.dayKey, today); return d >= 0 && d < n; }).length;
  return { weeks: buckets, currentStreakWeeks: streak, sessionsLast7: within(7), sessionsLast28: within(28) };
}

export interface MuscleStat {
  muscle: Muscle;
  /** Working sets in the window: primary = 1, secondary = 0.5. */
  sets: number;
  lastTrained?: string;
}

/** Recent training volume per muscle, from actual logged sets only. */
export function muscleVolume(sessions: WorkoutSession[], exercises: Map<string, Exercise>, today: string, windowDays = 7): Map<Muscle, MuscleStat> {
  const out = new Map<Muscle, MuscleStat>();
  const bump = (m: Muscle, n: number, day: string, inWindow: boolean) => {
    const cur = out.get(m) ?? { muscle: m, sets: 0 };
    if (inWindow) cur.sets += n;
    if (!cur.lastTrained || day > cur.lastTrained) cur.lastTrained = day;
    out.set(m, cur);
  };
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const age = daysBetween(s.dayKey, today);
    if (age < 0) continue;
    const inWindow = age < windowDays;
    for (const e of s.exercises) {
      const ex = exercises.get(e.exerciseId);
      if (!ex) continue;
      const n = e.sets.filter((x) => x.completed && x.kind === 'working').length;
      if (!n) continue;
      ex.primaryMuscles.forEach((m) => bump(m, n, s.dayKey, inWindow));
      ex.secondaryMuscles.forEach((m) => bump(m, n * 0.5, s.dayKey, inWindow));
    }
  }
  return out;
}

/** Most recent completed performance of an exercise, for "last time" hints. */
export function previousPerformance(sessions: WorkoutSession[], exerciseId: string, excludeSessionId?: string) {
  const prior = sessions
    .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const s of prior) {
    const e = s.exercises.find((x) => x.exerciseId === exerciseId);
    const sets = e?.sets.filter((x) => x.completed && x.kind === 'working');
    if (sets?.length) return { dayKey: s.dayKey, sets };
  }
  return undefined;
}

/**
 * Conservative progression suggestion: only when every working set hit the top
 * of the rep range with reported effort not maximal; small increments only.
 */
export function suggestNextLoad(
  lastSets: { reps?: number; weightKg?: number; rir?: number }[],
  repsMax: number,
  equipmentStepKg = 2.5,
): { weightKg?: number; reason: string } {
  const loaded = lastSets.filter((s) => s.weightKg !== undefined && s.reps !== undefined);
  if (!loaded.length) return { reason: 'No previous working sets — start light and focus on form.' };
  const weight = Math.max(...loaded.map((s) => s.weightKg!));
  const allTop = loaded.every((s) => (s.reps ?? 0) >= repsMax);
  const hardEffort = loaded.some((s) => s.rir !== undefined && s.rir <= 0);
  if (allTop && !hardEffort) return { weightKg: weight + equipmentStepKg, reason: `All sets reached ${repsMax} reps — try a small increase.` };
  return { weightKg: weight, reason: 'Repeat this load and aim for one more rep on some sets.' };
}
