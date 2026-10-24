import type { Exercise } from '../schemas/workout';
import type { ClinicianInstruction, DiscomfortLog } from '../schemas/wellness';
import { assessDiscomfort, combineAssessments, type DiscomfortAssessment } from './discomfort';
import { daysBetween } from '../dates';

export interface FilterContext {
  today: string;
  discomfortLogs?: DiscomfortLog[];
  clinicianInstructions?: ClinicianInstruction[];
  avoidedExerciseIds?: string[];
  /** Days a discomfort log stays "current" for filtering. */
  discomfortWindowDays?: number;
}

export interface ExclusionReason {
  exerciseId: string;
  reason: 'clinician' | 'user_avoided' | 'discomfort' | 'paused_region';
  detail: string;
}

export interface FilterResult {
  allowed: Exercise[];
  excluded: ExclusionReason[];
  assessment?: DiscomfortAssessment;
}

const JOINT_MUSCLES: Record<string, string[]> = {
  knee: ['quads', 'hamstrings', 'calves'],
  hip: ['glutes', 'hipAbductors', 'adductors'],
  ankle: ['calves'],
  shoulder: ['frontDelts', 'sideDelts', 'rearDelts', 'chest', 'upperChest'],
  elbow: ['biceps', 'triceps', 'forearms'],
  wrist: ['forearms'],
  neck: ['neck', 'traps'],
  lower_back: ['lowerBack'],
};

/**
 * Removes exercises that conflict with clinician instructions (always first),
 * the user's own avoid list, or current discomfort. Order of precedence matters:
 * clinician instructions can never be overridden by app or AI suggestions.
 */
export function filterExercises(exercises: Exercise[], ctx: FilterContext): FilterResult {
  const windowDays = ctx.discomfortWindowDays ?? 7;
  const current = (ctx.discomfortLogs ?? []).filter((l) => {
    const age = daysBetween(l.dayKey, ctx.today);
    return age >= 0 && age < windowDays;
  });
  const assessments = current.map((l) => ({ log: l, a: assessDiscomfort(l) }));
  const assessment = combineAssessments(assessments.map((x) => x.a));
  const pausedJoints = new Set(assessments.filter((x) => x.a.pauseRegion).map((x) => x.log.joint));
  const pausedMuscles = new Set([...pausedJoints].flatMap((j) => JOINT_MUSCLES[j] ?? []));

  const activeInstr = (ctx.clinicianInstructions ?? []).filter((c) => c.active);
  const clinicianIds = new Set(activeInstr.flatMap((c) => c.avoidExerciseIds));
  const clinicianTags = new Set(activeInstr.flatMap((c) => c.avoidTags));
  const userIds = new Set(ctx.avoidedExerciseIds ?? []);
  const discomfortTags = new Set(assessment?.avoidTags ?? []);

  const allowed: Exercise[] = [];
  const excluded: ExclusionReason[] = [];
  for (const ex of exercises) {
    if (clinicianIds.has(ex.id) || ex.loadTags.some((t) => clinicianTags.has(t))) {
      excluded.push({ exerciseId: ex.id, reason: 'clinician', detail: 'Excluded by your clinician’s instructions' });
      continue;
    }
    if (userIds.has(ex.id)) {
      excluded.push({ exerciseId: ex.id, reason: 'user_avoided', detail: 'On your avoid list' });
      continue;
    }
    if (pausedMuscles.size && ex.primaryMuscles.some((m) => pausedMuscles.has(m)) && ex.type !== 'mobility') {
      excluded.push({ exerciseId: ex.id, reason: 'paused_region', detail: 'Paused until the discomfort you logged has been assessed' });
      continue;
    }
    const hit = ex.loadTags.find((t) => discomfortTags.has(t));
    if (hit) {
      excluded.push({ exerciseId: ex.id, reason: 'discomfort', detail: `Set aside while you have discomfort (${hit.replace(/_/g, ' ')})` });
      continue;
    }
    allowed.push(ex);
  }
  return { allowed, excluded, assessment };
}
