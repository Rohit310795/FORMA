import { z } from 'zod';
import { EQUIPMENT } from './profile';
import { baseRecord, dayKeySchema, isoDateTime, longText, shortText } from './common';

export const MUSCLES = [
  'chest',
  'upperChest',
  'frontDelts',
  'sideDelts',
  'rearDelts',
  'traps',
  'upperBack',
  'lats',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'lowerBack',
  'glutes',
  'hipAbductors',
  'adductors',
  'quads',
  'hamstrings',
  'calves',
  'neck',
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const EXERCISE_TYPES = ['strength', 'hypertrophy', 'core', 'mobility', 'cardio', 'plyometric', 'isometric', 'balance'] as const;
export const DIFFICULTY = ['beginner', 'intermediate', 'advanced'] as const;

export const exerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  primaryMuscles: z.array(z.enum(MUSCLES)).min(1),
  secondaryMuscles: z.array(z.enum(MUSCLES)).default([]),
  equipment: z.array(z.enum(EQUIPMENT)).min(1),
  difficulty: z.enum(DIFFICULTY),
  type: z.enum(EXERCISE_TYPES),
  instructions: z.array(z.string()).min(1),
  formCues: z.array(z.string()).default([]),
  commonMistakes: z.array(z.string()).default([]),
  breathing: z.string().optional(),
  safety: z.array(z.string()).default([]),
  easier: z.array(z.string()).default([]),
  harder: z.array(z.string()).default([]),
  substitutions: z.array(z.string()).default([]),
  mobilityPrereqs: z.array(z.string()).default([]),
  /** Tags used by the safety engine (e.g. 'deep_knee_flexion', 'impact'). */
  loadTags: z.array(z.string()).default([]),
  /** Only set when media is licensed for use. Never a guessed URL. */
  media: z.object({ url: z.string().url(), license: z.string(), credit: z.string() }).optional(),
  /** Count reps per side, or log time instead of reps. */
  unilateral: z.boolean().default(false),
  timed: z.boolean().default(false),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const plannedExerciseSchema = z.object({
  /** Stable key within the plan day, so reordering keeps history links intact. */
  key: z.string().max(64),
  exerciseId: z.string().max(64),
  sets: z.number().int().min(1).max(10),
  repsMin: z.number().int().min(1).max(100),
  repsMax: z.number().int().min(1).max(100),
  /** Seconds, for timed holds. */
  durationSec: z.number().int().min(5).max(600).optional(),
  restSec: z.number().int().min(0).max(600).default(90),
  /** Target effort as reps-in-reserve (0–5). */
  targetRir: z.number().int().min(0).max(5).optional(),
  warmupSets: z.number().int().min(0).max(5).default(0),
  note: shortText.optional(),
});
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;

export const planDaySchema = z.object({
  key: z.string().max(64),
  name: shortText.min(1),
  focus: shortText.optional(),
  /** ISO weekday 1–7 when the day is scheduled; omitted for unscheduled days. */
  weekday: z.number().int().min(1).max(7).optional(),
  warmupRoutineId: z.string().optional(),
  cooldownRoutineId: z.string().optional(),
  exercises: z.array(plannedExerciseSchema).max(15),
});
export type PlanDay = z.infer<typeof planDaySchema>;

export const SPLIT_TYPES = ['ppl', 'upper_lower', 'full_body', 'bro', 'strength', 'hypertrophy', 'beginner', 'home', 'custom'] as const;

export const workoutPlanSchema = baseRecord.extend({
  name: shortText.min(1),
  split: z.enum(SPLIT_TYPES),
  description: longText.optional(),
  sessionMinutes: z.number().int().min(10).max(180).default(45),
  equipment: z.array(z.enum(EQUIPMENT)).default([]),
  days: z.array(planDaySchema).min(1).max(7),
  active: z.boolean().default(true),
  /** Plans are versioned: editing a plan never touches completed session history. */
  version: z.number().int().min(1).default(1),
  archivedAt: isoDateTime.optional(),
});
export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;

export const loggedSetSchema = z.object({
  kind: z.enum(['warmup', 'working']).default('working'),
  reps: z.number().int().min(0).max(200).optional(),
  weightKg: z.number().min(0).max(1000).optional(),
  durationSec: z.number().int().min(0).max(7200).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().default(false),
  completedAt: isoDateTime.optional(),
});
export type LoggedSet = z.infer<typeof loggedSetSchema>;

export const sessionExerciseSchema = z.object({
  key: z.string().max(64),
  exerciseId: z.string().max(64),
  /** Set when the user swapped the planned exercise. */
  substitutedFrom: z.string().max(64).optional(),
  sets: z.array(loggedSetSchema).max(20),
  restSec: z.number().int().min(0).max(600).default(90),
  note: shortText.optional(),
  discomfort: z
    .object({
      area: z.string().max(40),
      severity: z.number().int().min(0).max(10),
      sharp: z.boolean().default(false),
    })
    .optional(),
});
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;

export const workoutSessionSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  planId: z.string().max(128).optional(),
  planVersion: z.number().int().optional(),
  planDayKey: z.string().max(64).optional(),
  name: shortText.min(1),
  status: z.enum(['in_progress', 'paused', 'completed', 'abandoned']),
  startedAt: isoDateTime,
  endedAt: isoDateTime.optional(),
  /** Accumulated paused milliseconds so duration excludes pauses. */
  pausedMs: z.number().int().min(0).default(0),
  pausedAt: isoDateTime.optional(),
  exercises: z.array(sessionExerciseSchema).max(20),
  effort: z.number().int().min(1).max(10).optional(),
  note: longText.optional(),
  /** HealthKit workout UUID when imported, used to de-duplicate imports. */
  externalId: z.string().max(128).optional(),
  activityType: z.string().max(60).optional(),
  energyKcal: z.number().min(0).max(10000).optional(),
});
export type WorkoutSession = z.infer<typeof workoutSessionSchema>;
