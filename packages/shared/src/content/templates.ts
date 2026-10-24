import type { Equipment, Experience } from '../schemas/profile';
import type { Exercise, PlanDay, PlannedExercise, WorkoutPlan } from '../schemas/workout';
import { SPLIT_TYPES } from '../schemas/workout';

type Split = (typeof SPLIT_TYPES)[number];

/** A slot lists candidate exercises in preference order; the first usable one wins. */
interface Slot {
  candidates: string[];
  reps: [number, number];
  rest: number;
  timedSec?: number;
}
interface DayTemplate {
  name: string;
  focus: string;
  slots: Slot[];
}
export interface SplitTemplate {
  split: Split;
  name: string;
  description: string;
  daysPerWeek: number;
  /** Suggested ISO weekdays when the user hasn't picked days. */
  defaultWeekdays: number[];
  days: DayTemplate[];
}

const S = (candidates: string[], reps: [number, number], rest = 90, timedSec?: number): Slot => ({ candidates, reps, rest, timedSec });

const PUSH: DayTemplate = {
  name: 'Push', focus: 'Chest · Shoulders · Triceps',
  slots: [
    S(['barbell-bench-press', 'dumbbell-bench-press', 'machine-chest-press', 'push-up', 'incline-push-up'], [6, 10], 120),
    S(['incline-dumbbell-press', 'machine-chest-press', 'incline-push-up'], [8, 12]),
    S(['seated-dumbbell-shoulder-press', 'overhead-press', 'push-up'], [8, 12]),
    S(['lateral-raise', 'band-pull-apart'], [12, 15], 60),
    S(['cable-triceps-pushdown', 'overhead-triceps-extension', 'close-grip-push-up'], [10, 15], 60),
    S(['cable-crossover', 'dumbbell-chest-fly'], [12, 15], 60),
  ],
};
const PULL: DayTemplate = {
  name: 'Pull', focus: 'Back · Biceps',
  slots: [
    S(['lat-pulldown', 'pull-up', 'inverted-row'], [8, 12], 120),
    S(['seated-cable-row', 'one-arm-dumbbell-row', 'inverted-row'], [8, 12]),
    S(['face-pull', 'band-pull-apart', 'rear-delt-fly'], [12, 15], 60),
    S(['dumbbell-curl', 'hammer-curl'], [10, 12], 60),
    S(['hammer-curl', 'dumbbell-curl'], [10, 12], 60),
    S(['farmer-carry', 'suitcase-carry'], [1, 1], 90, 40),
  ],
};
const LEGS: DayTemplate = {
  name: 'Legs', focus: 'Quads · Glutes · Hamstrings · Calves',
  slots: [
    S(['back-squat', 'goblet-squat', 'leg-press', 'box-squat', 'sit-to-stand'], [6, 10], 150),
    S(['romanian-deadlift', 'hip-thrust', 'glute-bridge'], [8, 12], 120),
    S(['bulgarian-split-squat', 'reverse-lunge', 'step-up', 'leg-press'], [8, 12]),
    S(['lying-leg-curl', 'glute-bridge'], [10, 15], 60),
    S(['standing-calf-raise', 'seated-calf-raise'], [12, 15], 60),
    S(['plank', 'dead-bug'], [1, 1], 60, 30),
  ],
};
const UPPER: DayTemplate = {
  name: 'Upper Body', focus: 'Chest · Back · Arms',
  slots: [
    S(['barbell-bench-press', 'dumbbell-bench-press', 'push-up'], [6, 10], 120),
    S(['seated-cable-row', 'one-arm-dumbbell-row', 'inverted-row'], [8, 12], 90),
    S(['seated-dumbbell-shoulder-press', 'incline-dumbbell-press', 'incline-push-up'], [8, 12]),
    S(['lat-pulldown', 'pull-up', 'inverted-row'], [8, 12]),
    S(['dumbbell-curl', 'hammer-curl'], [10, 12], 60),
    S(['cable-triceps-pushdown', 'close-grip-push-up'], [10, 12], 60),
  ],
};
const LOWER: DayTemplate = {
  name: 'Lower Body', focus: 'Legs · Glutes · Core',
  slots: [
    S(['back-squat', 'goblet-squat', 'leg-press', 'box-squat'], [6, 10], 150),
    S(['romanian-deadlift', 'hip-thrust', 'glute-bridge'], [8, 12], 120),
    S(['reverse-lunge', 'step-up', 'leg-press'], [8, 12]),
    S(['lying-leg-curl', 'glute-bridge'], [10, 15], 60),
    S(['standing-calf-raise'], [12, 15], 60),
    S(['side-plank', 'pallof-press'], [1, 1], 60, 30),
  ],
};
const FULL_A: DayTemplate = {
  name: 'Full Body A', focus: 'Squat · Push · Pull',
  slots: [
    S(['goblet-squat', 'back-squat', 'leg-press', 'box-squat', 'sit-to-stand'], [8, 12], 120),
    S(['dumbbell-bench-press', 'push-up', 'incline-push-up', 'machine-chest-press'], [8, 12]),
    S(['seated-cable-row', 'one-arm-dumbbell-row', 'inverted-row'], [8, 12]),
    S(['glute-bridge', 'hip-thrust'], [10, 15], 60),
    S(['plank', 'dead-bug'], [1, 1], 60, 30),
  ],
};
const FULL_B: DayTemplate = {
  name: 'Full Body B', focus: 'Hinge · Press · Pull',
  slots: [
    S(['romanian-deadlift', 'glute-bridge', 'hip-thrust'], [8, 12], 120),
    S(['seated-dumbbell-shoulder-press', 'incline-push-up', 'push-up'], [8, 12]),
    S(['lat-pulldown', 'inverted-row', 'one-arm-dumbbell-row'], [8, 12]),
    S(['reverse-lunge', 'step-up', 'sit-to-stand'], [8, 12]),
    S(['side-plank', 'bird-dog'], [1, 1], 60, 30),
  ],
};
const HOME_A: DayTemplate = {
  name: 'Home Strength A', focus: 'Full body · minimal equipment',
  slots: [
    S(['goblet-squat', 'box-squat', 'sit-to-stand'], [10, 15], 90),
    S(['push-up', 'incline-push-up'], [6, 12]),
    S(['one-arm-dumbbell-row', 'inverted-row', 'band-pull-apart'], [10, 12]),
    S(['glute-bridge'], [12, 15], 60),
    S(['dead-bug', 'plank'], [8, 10], 60),
  ],
};
const HOME_B: DayTemplate = {
  name: 'Home Strength B', focus: 'Full body · minimal equipment',
  slots: [
    S(['reverse-lunge', 'step-up', 'sit-to-stand'], [8, 12], 90),
    S(['incline-push-up', 'push-up'], [8, 12]),
    S(['band-pull-apart', 'face-pull'], [12, 15], 60),
    S(['side-lying-hip-abduction', 'lateral-band-walk'], [12, 15], 60),
    S(['side-plank', 'bird-dog'], [1, 1], 60, 30),
  ],
};
const CHEST_DAY: DayTemplate = { ...PUSH, name: 'Chest', focus: 'Chest', slots: [PUSH.slots[0]!, PUSH.slots[1]!, PUSH.slots[5]!, S(['push-up', 'incline-push-up'], [8, 15])] };
const BACK_DAY: DayTemplate = { ...PULL, name: 'Back', focus: 'Back', slots: [PULL.slots[0]!, PULL.slots[1]!, S(['barbell-row', 'one-arm-dumbbell-row'], [8, 12]), PULL.slots[2]!] };
const SHOULDER_DAY: DayTemplate = { name: 'Shoulders', focus: 'Shoulders', slots: [PUSH.slots[2]!, PUSH.slots[3]!, PULL.slots[2]!, S(['rear-delt-fly', 'band-pull-apart'], [12, 15], 60)] };
const ARM_DAY: DayTemplate = { name: 'Arms', focus: 'Biceps · Triceps', slots: [S(['dumbbell-curl'], [10, 12], 60), S(['cable-triceps-pushdown', 'close-grip-push-up'], [10, 12], 60), S(['hammer-curl'], [10, 12], 60), S(['overhead-triceps-extension', 'cable-triceps-pushdown'], [10, 12], 60)] };
const STRENGTH_A: DayTemplate = {
  name: 'Strength A', focus: 'Squat · Bench · Row',
  slots: [S(['back-squat', 'goblet-squat', 'leg-press'], [3, 6], 180), S(['barbell-bench-press', 'dumbbell-bench-press'], [3, 6], 180), S(['barbell-row', 'seated-cable-row'], [5, 8], 120), S(['plank'], [1, 1], 60, 40)],
};
const STRENGTH_B: DayTemplate = {
  name: 'Strength B', focus: 'Deadlift · Press · Pull',
  slots: [S(['deadlift', 'romanian-deadlift'], [3, 5], 180), S(['overhead-press', 'seated-dumbbell-shoulder-press'], [3, 6], 150), S(['pull-up', 'lat-pulldown'], [5, 8], 120), S(['farmer-carry'], [1, 1], 90, 40)],
};
const BEGINNER_A: DayTemplate = {
  name: 'Foundations A', focus: 'Learn the basics',
  slots: [S(['box-squat', 'goblet-squat', 'sit-to-stand'], [8, 12], 90), S(['incline-push-up', 'machine-chest-press'], [8, 12]), S(['seated-cable-row', 'inverted-row', 'band-pull-apart'], [10, 12]), S(['glute-bridge'], [10, 12], 60), S(['dead-bug'], [6, 8], 60)],
};
const BEGINNER_B: DayTemplate = {
  name: 'Foundations B', focus: 'Learn the basics',
  slots: [S(['step-up', 'reverse-lunge', 'sit-to-stand'], [8, 10], 90), S(['seated-dumbbell-shoulder-press', 'incline-push-up'], [8, 12]), S(['lat-pulldown', 'inverted-row'], [10, 12]), S(['side-lying-hip-abduction'], [10, 12], 60), S(['plank'], [1, 1], 60, 20)],
};

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  { split: 'ppl', name: 'Push / Pull / Legs', description: 'Classic three-day rotation. Run once (3 days) or twice (6 days) a week.', daysPerWeek: 3, defaultWeekdays: [1, 3, 5], days: [PUSH, PULL, LEGS] },
  { split: 'upper_lower', name: 'Upper / Lower', description: 'Four balanced days: two upper, two lower.', daysPerWeek: 4, defaultWeekdays: [1, 2, 4, 5], days: [UPPER, LOWER, UPPER, LOWER] },
  { split: 'full_body', name: 'Full Body', description: 'Two alternating full-body sessions, 2–3 times a week.', daysPerWeek: 3, defaultWeekdays: [1, 3, 5], days: [FULL_A, FULL_B, FULL_A] },
  { split: 'bro', name: 'Body-Part Split', description: 'One main area per day, five days a week.', daysPerWeek: 5, defaultWeekdays: [1, 2, 3, 4, 5], days: [CHEST_DAY, BACK_DAY, LEGS, SHOULDER_DAY, ARM_DAY] },
  { split: 'strength', name: 'Strength Focus', description: 'Lower reps, longer rests, big lifts. Best with some experience.', daysPerWeek: 3, defaultWeekdays: [1, 3, 5], days: [STRENGTH_A, STRENGTH_B, STRENGTH_A] },
  { split: 'hypertrophy', name: 'Hypertrophy Focus', description: 'Moderate reps across four days to build muscle.', daysPerWeek: 4, defaultWeekdays: [1, 2, 4, 5], days: [UPPER, LOWER, PUSH, PULL] },
  { split: 'beginner', name: 'Beginner Foundations', description: 'Simple, low-volume sessions to learn movements safely.', daysPerWeek: 2, defaultWeekdays: [2, 5], days: [BEGINNER_A, BEGINNER_B] },
  { split: 'home', name: 'Home Workouts', description: 'Bodyweight, dumbbells and bands.', daysPerWeek: 3, defaultWeekdays: [1, 3, 5], days: [HOME_A, HOME_B, HOME_A] },
];

export interface BuildOptions {
  split: Split;
  equipment: Equipment[];
  experience: Experience;
  sessionMinutes: number;
  trainingDays?: number[];
  /** Exercises allowed after the safety filter (clinician, avoid list, discomfort). */
  allowed: Exercise[];
  preferredExerciseIds?: string[];
  now: string;
  id: string;
}

/** Conservative default volumes by experience. */
export const SETS_BY_EXPERIENCE: Record<Experience, number> = { new: 2, beginner: 2, intermediate: 3, advanced: 3 };

function usable(ex: Exercise, equipment: Set<Equipment>) {
  // Bodyweight exercises are always usable; otherwise every listed item is an alternative.
  return ex.equipment.includes('bodyweight') || ex.equipment.some((e) => equipment.has(e));
}

export function buildPlanFromTemplate(opts: BuildOptions): WorkoutPlan {
  const template = SPLIT_TEMPLATES.find((t) => t.split === opts.split) ?? SPLIT_TEMPLATES[2]!;
  const allowed = new Map(opts.allowed.map((e) => [e.id, e]));
  const equipment = new Set<Equipment>([...opts.equipment, 'bodyweight']);
  const preferred = new Set(opts.preferredExerciseIds ?? []);
  const maxExercises = Math.max(3, Math.min(6, Math.floor(opts.sessionMinutes / 8)));
  const sets = SETS_BY_EXPERIENCE[opts.experience];
  const weekdays = opts.trainingDays?.length ? [...opts.trainingDays].sort() : template.defaultWeekdays;

  const days: PlanDay[] = template.days.map((d, di) => {
    const used = new Set<string>();
    const exercises: PlannedExercise[] = [];
    for (const [si, slot] of d.slots.entries()) {
      if (exercises.length >= maxExercises) break;
      const candidates = slot.candidates.filter((c) => allowed.has(c) && !used.has(c) && usable(allowed.get(c)!, equipment));
      const pick = candidates.find((c) => preferred.has(c)) ?? candidates[0];
      if (!pick) continue;
      used.add(pick);
      const ex = allowed.get(pick)!;
      exercises.push({
        key: `d${di}s${si}`,
        exerciseId: pick,
        sets: ex.type === 'core' || ex.timed ? Math.min(sets, 3) : sets,
        repsMin: slot.reps[0],
        repsMax: slot.reps[1],
        durationSec: ex.timed ? (slot.timedSec ?? 30) : undefined,
        restSec: slot.rest,
        targetRir: opts.experience === 'new' || opts.experience === 'beginner' ? 3 : 2,
        warmupSets: si === 0 && ex.type === 'strength' && opts.experience !== 'new' ? 1 : 0,
      });
    }
    return {
      key: `day${di}`,
      name: d.name,
      focus: d.focus,
      weekday: weekdays[di],
      warmupRoutineId: 'general-warmup',
      cooldownRoutineId: 'post-workout-cooldown',
      exercises,
    };
  });

  return {
    id: opts.id,
    name: template.name,
    split: template.split,
    description: template.description,
    sessionMinutes: opts.sessionMinutes,
    equipment: opts.equipment,
    days: days.filter((d) => d.exercises.length > 0),
    active: true,
    version: 1,
    createdAt: opts.now,
    updatedAt: opts.now,
    revision: 0,
    source: 'template',
  };
}
