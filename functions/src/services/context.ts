import {
  assessDiscomfort,
  dayKey as toDayKey,
  addDays,
  ageFromBirthDate,
  completedSetCount,
  personalRecords,
  EXERCISE_MAP,
  type AiContextCategory,
  type WorkoutSession,
  type DiscomfortLog,
} from '@forma/shared';
import { db } from '../lib/firebase';

/**
 * Builds a compact, minimal text summary of ONLY the permitted categories.
 * Summaries, not raw logs: no names, no free-text notes except clinician
 * instructions (which the user explicitly consented to share for safety).
 */
export async function buildContext(uid: string, categories: AiContextCategory[], today = toDayKey(new Date())): Promise<string> {
  const lines: string[] = [];
  const col = (name: string) => db.collection(`users/${uid}/${name}`);
  const recent = async <T>(name: string, days: number, limit = 60) =>
    (await col(name).where('dayKey', '>=', addDays(today, -days)).orderBy('dayKey', 'desc').limit(limit).get()).docs.map((d) => d.data() as T);
  const profile = (await db.doc(`users/${uid}/profile/main`).get()).data();
  const want = new Set(categories);

  if (want.has('profile') && profile) {
    const age = profile.birthDate ? ageFromBirthDate(profile.birthDate, today) : undefined;
    const band = age ? `${Math.floor(age / 10) * 10}s` : 'unknown';
    lines.push(`Profile: age ${band}; experience ${profile.experience}; trains at ${profile.trainingLocation}; ${profile.sessionMinutes}-minute sessions; equipment: ${(profile.equipment ?? []).join(', ') || 'bodyweight'}; units ${profile.units}.`);
    if (profile.avoidedExerciseIds?.length) lines.push(`Exercises the user wants to avoid: ${profile.avoidedExerciseIds.join(', ')}.`);
  }
  if (want.has('goals') && profile) {
    lines.push(`Goals: ${(profile.goals ?? []).join(', ') || 'not set'}${profile.primaryGoal ? ` (primary: ${profile.primaryGoal})` : ''}. Training days per week: ${(profile.trainingDays ?? []).length || 'not set'}.`);
    if (profile.dietPreference && profile.dietPreference !== 'none') lines.push(`Diet preference: ${profile.dietPreference}.`);
    if (profile.allergies?.length) lines.push(`Allergies: ${profile.allergies.join(', ')}.`);
  }
  if (want.has('workouts')) {
    const sessions = (await recent<WorkoutSession>('workoutSessions', 28)).filter((s) => s.status === 'completed');
    lines.push(`Workouts (last 28 days): ${sessions.length} completed.`);
    for (const s of sessions.slice(0, 5)) lines.push(`- ${s.dayKey}: ${s.name}, ${completedSetCount(s)} working sets${s.effort ? `, effort ${s.effort}/10` : ''}.`);
    const prs = [...personalRecords(sessions).entries()].slice(0, 5);
    if (prs.length) lines.push(`Recent bests: ${prs.map(([id, r]) => `${EXERCISE_MAP.get(id)?.name ?? id} ${r.heaviest?.weightKg}kg×${r.heaviest?.reps}`).join('; ')}.`);
  }
  if (want.has('body')) {
    const m = await recent<{ dayKey: string; weightKg?: number; sites?: Record<string, number> }>('bodyMeasurements', 60, 30);
    const withWeight = m.filter((x) => x.weightKg);
    if (withWeight.length) {
      const latest = withWeight[0]!;
      const oldest = withWeight[withWeight.length - 1]!;
      lines.push(`Body: latest weight ${latest.weightKg} kg (${latest.dayKey}); ${withWeight.length > 1 ? `change since ${oldest.dayKey}: ${(latest.weightKg! - oldest.weightKg!).toFixed(1)} kg` : 'single entry'}. Scale changes alone do not show fat or muscle change.`);
    } else lines.push('Body: no recent measurements.');
  }
  if (want.has('nutrition')) {
    const logs = await recent<{ dayKey: string; macros: { kcal: number; proteinG: number } }>('nutritionLogs', 7, 200);
    const days = new Map<string, { kcal: number; p: number }>();
    for (const l of logs) {
      const d = days.get(l.dayKey) ?? { kcal: 0, p: 0 };
      d.kcal += l.macros.kcal;
      d.p += l.macros.proteinG;
      days.set(l.dayKey, d);
    }
    const targets = (await db.doc(`users/${uid}/settings/nutritionTargets`).get()).data();
    if (days.size) {
      const avgK = Math.round([...days.values()].reduce((s, d) => s + d.kcal, 0) / days.size);
      const avgP = Math.round([...days.values()].reduce((s, d) => s + d.p, 0) / days.size);
      lines.push(`Nutrition (logged on ${days.size} of last 7 days, estimates): avg ${avgK} kcal, ${avgP} g protein per logged day${targets ? `; targets ${targets.kcal} kcal / ${targets.proteinG} g protein` : ''}.`);
    } else lines.push('Nutrition: nothing logged in the last 7 days.');
  }
  if (want.has('sleep')) {
    const s = await recent<{ durationMin: number; source?: string }>('sleepLogs', 7, 14);
    if (s.length) lines.push(`Sleep (last 7 days): average ${(s.reduce((a, x) => a + x.durationMin, 0) / s.length / 60).toFixed(1)} h over ${s.length} nights.`);
  }
  if (want.has('recovery')) {
    const c = (await recent<Record<string, number>>('recoveryCheckIns', 3, 1))[0];
    if (c) lines.push(`Latest recovery check-in: soreness ${c.soreness ?? '?'}/5, fatigue ${c.fatigue ?? '?'}/5, stress ${c.stress ?? '?'}/5, sleep quality ${c.sleepQuality ?? '?'}/5.`);
  }
  if (want.has('discomfort')) {
    const logs = await recent<DiscomfortLog>('discomfortLogs', 14, 10);
    for (const l of logs.slice(0, 3)) {
      const a = assessDiscomfort(l);
      lines.push(`Discomfort ${l.dayKey}: ${l.joint} (${l.side}), ${l.severity}/10, trend ${l.trend}; app safety level: ${a.level}; avoid: ${a.avoidTags.join(', ') || 'none'}.`);
    }
    const instr = (await col('clinicianInstructions').where('active', '==', true).limit(5).get()).docs.map((d) => d.data());
    for (const i of instr) lines.push(`Clinician instruction (must be followed): ${String(i.instructions).slice(0, 400)}`);
  }
  if (want.has('supplements')) {
    const s = (await col('supplementInventory').where('active', '==', true).limit(15).get()).docs.map((d) => d.data().name as string);
    if (s.length) lines.push(`Supplements the user takes: ${s.join(', ')}.`);
  }
  return lines.join('\n');
}
