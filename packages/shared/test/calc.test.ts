import { describe, expect, it } from 'vitest';
import {
  bmrMifflinStJeor, tdee, macroTargets, MIN_KCAL_TARGET, suggestedWaterMl, estimateOneRepMax, sessionVolumeKg,
  personalRecords, newRecordsInSession, consistency, muscleVolume, EXERCISE_MAP, suggestNextLoad, recoveryEstimate,
  trend, sessionDurationMin, type WorkoutSession, dayKey, addDays, weekStart, ageFromBirthDate, formatWeight, toKg,
} from '../src';

const session = (id: string, day: string, sets: { reps: number; kg: number; done?: boolean; kind?: 'warmup' | 'working' }[], status: WorkoutSession['status'] = 'completed', exerciseId = 'barbell-bench-press'): WorkoutSession => ({
  id, dayKey: day, name: 'Push', status, startedAt: `${day}T10:00:00.000Z`, endedAt: `${day}T11:00:00.000Z`, pausedMs: 600000,
  createdAt: `${day}T10:00:00.000Z`, updatedAt: `${day}T11:00:00.000Z`, revision: 0, source: 'manual',
  exercises: [{ key: 'a', exerciseId, restSec: 90, sets: sets.map((s) => ({ kind: s.kind ?? 'working', reps: s.reps, weightKg: s.kg, completed: s.done ?? true })) }],
});

describe('energy', () => {
  it('matches Mifflin–St Jeor reference values', () => {
    expect(bmrMifflinStJeor({ weightKg: 70, heightCm: 175, age: 28, calcSex: 'male' })).toBe(1659);
    expect(bmrMifflinStJeor({ weightKg: 60, heightCm: 165, age: 30, calcSex: 'female' })).toBe(1320);
    expect(tdee({ weightKg: 70, heightCm: 175, age: 28, calcSex: 'male', activity: 'moderate' })).toBe(Math.round(1659 * 1.55));
  });

  it('caps deficits and never goes below the safe floor', () => {
    const t = macroTargets({ weightKg: 45, heightCm: 150, age: 60, calcSex: 'female', activity: 'sedentary' }, 'lose');
    expect(t.kcal).toBeGreaterThanOrEqual(MIN_KCAL_TARGET);
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr);
    const big = macroTargets({ weightKg: 120, heightCm: 190, age: 30, calcSex: 'male', activity: 'active' }, 'lose');
    expect(big.adjustmentKcal).toBe(-500);
    const gain = macroTargets({ weightKg: 70, heightCm: 175, age: 28, calcSex: 'male', activity: 'moderate' }, 'gain');
    expect(gain.adjustmentKcal).toBeLessThanOrEqual(300);
    expect(gain.proteinG).toBe(112);
  });

  it('suggests clamped, adjustable water targets', () => {
    expect(suggestedWaterMl(70)).toBe(2300);
    expect(suggestedWaterMl(200, 'very_active')).toBe(4000);
    expect(suggestedWaterMl(30)).toBe(1500);
  });
});

describe('training', () => {
  it('computes e1RM only in a valid rep range', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 20)).toBeUndefined();
  });

  it('counts only completed working sets for volume and duration excludes pauses', () => {
    const s = session('s1', '2026-10-01', [{ reps: 10, kg: 20, kind: 'warmup' }, { reps: 8, kg: 60 }, { reps: 8, kg: 60, done: false }]);
    expect(sessionVolumeKg(s)).toBe(480);
    expect(sessionDurationMin(s)).toBe(50);
  });

  it('derives PRs from completed sessions only', () => {
    const a = session('a', '2026-10-01', [{ reps: 5, kg: 80 }]);
    const b = session('b', '2026-10-05', [{ reps: 3, kg: 85 }]);
    const ghost = session('c', '2026-10-06', [{ reps: 5, kg: 200 }], 'abandoned');
    const prs = personalRecords([a, b, ghost]).get('barbell-bench-press')!;
    expect(prs.heaviest?.value).toBe(85);
    expect(newRecordsInSession(b, [a]).map((r) => r.kind)).toEqual(['heaviest', 'e1rm']);
  });

  it('computes consistency streaks without penalising the current week', () => {
    const today = '2026-10-21'; // Wednesday
    const sessions = [session('1', '2026-10-06', []), session('2', '2026-10-13', []), session('3', '2026-10-14', [])];
    const c = consistency(sessions, today, 4);
    expect(c.weeks.map((w) => w.sessions)).toEqual([0, 1, 2, 0]);
    expect(c.currentStreakWeeks).toBe(2);
  });

  it('tracks per-muscle volume and last trained', () => {
    const s = session('1', '2026-10-20', [{ reps: 8, kg: 60 }, { reps: 8, kg: 60 }]);
    const v = muscleVolume([s], EXERCISE_MAP, '2026-10-21');
    expect(v.get('chest')?.sets).toBe(2);
    expect(v.get('triceps')?.sets).toBe(1);
    expect(v.get('chest')?.lastTrained).toBe('2026-10-20');
  });

  it('progresses load conservatively', () => {
    expect(suggestNextLoad([{ reps: 10, weightKg: 40, rir: 2 }, { reps: 10, weightKg: 40, rir: 1 }], 10).weightKg).toBe(42.5);
    expect(suggestNextLoad([{ reps: 10, weightKg: 40, rir: 0 }], 10).weightKg).toBe(40);
    expect(suggestNextLoad([{ reps: 7, weightKg: 40 }], 10).weightKg).toBe(40);
  });
});

describe('recovery estimate', () => {
  it('refuses to guess with too little input', () => {
    expect(recoveryEstimate({}).score).toBeNull();
  });
  it('is transparent and caps when discomfort is reported', () => {
    const good = recoveryEstimate({ checkIn: { sleepHours: 8, sleepQuality: 5, soreness: 1, fatigue: 1, stress: 1 } });
    expect(good.score).toBe(100);
    expect(good.components).toHaveLength(5);
    const capped = recoveryEstimate({ checkIn: { sleepHours: 8, sleepQuality: 5, soreness: 1, fatigue: 1, stress: 1, discomfortReported: true } });
    expect(capped.score).toBe(60);
    expect(capped.capped).toBe(true);
    expect(capped.disclaimer).toMatch(/does not measure/);
  });
});

describe('progress + dates + units', () => {
  it('describes trends without causal claims', () => {
    const t = trend([{ dayKey: '2026-10-01', value: 70 }, { dayKey: '2026-10-15', value: 69.2 }], '2026-10-20', 30, 'kg');
    expect(t.change).toBe(-0.8);
    expect(t.description).toMatch(/down 0.8 kg/);
    expect(t.description).not.toMatch(/fat|muscle/);
  });
  it('handles timezone-aware day keys', () => {
    const d = new Date('2026-10-20T20:00:00Z');
    expect(dayKey(d, 'Asia/Kolkata')).toBe('2026-10-21');
    expect(dayKey(d, 'America/New_York')).toBe('2026-10-20');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(ageFromBirthDate('1998-10-25', '2026-10-24')).toBe(27);
  });
  it('converts units', () => {
    expect(formatWeight(100, 'imperial')).toBe('220.5 lb');
    expect(toKg(220.462, 'imperial')).toBeCloseTo(100, 1);
  });
});
