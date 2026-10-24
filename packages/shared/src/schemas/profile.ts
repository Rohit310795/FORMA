import { z } from 'zod';
import { AI_CONTEXT_CATEGORIES } from '../features';
import { dayKeySchema, isoDateTime, shortText } from './common';

export const GOALS = [
  'muscle_gain',
  'fat_loss',
  'recomposition',
  'strength',
  'general_fitness',
  'mobility',
  'cardio_fitness',
  'consistency',
  'wellness',
] as const;
export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  muscle_gain: 'Build muscle',
  fat_loss: 'Lose fat',
  recomposition: 'Body recomposition',
  strength: 'Get stronger',
  general_fitness: 'General fitness',
  mobility: 'Better mobility',
  cardio_fitness: 'Cardio fitness',
  consistency: 'Build consistency',
  wellness: 'General wellness',
};

export const EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'kettlebell',
  'cable',
  'machine',
  'band',
  'bench',
  'pullup_bar',
  'pool',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: 'Bodyweight',
  dumbbell: 'Dumbbells',
  barbell: 'Barbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machines',
  band: 'Resistance bands',
  bench: 'Bench',
  pullup_bar: 'Pull-up bar',
  pool: 'Pool',
};

export const EXPERIENCE = ['new', 'beginner', 'intermediate', 'advanced'] as const;
export type Experience = (typeof EXPERIENCE)[number];

export const DIET_PREFERENCES = [
  'none',
  'vegetarian',
  'eggetarian',
  'vegan',
  'pescatarian',
  'jain',
  'halal',
  'kosher',
  'gluten_free',
  'dairy_free',
] as const;

/**
 * Sex for calculation purposes is optional and only used for BMR estimation.
 * The UI explains why it is asked; goals are never inferred from it.
 */
export const calcSexSchema = z.enum(['female', 'male', 'prefer_not']);

export const consentSchema = z.object({
  termsAcceptedAt: isoDateTime.optional(),
  privacyAcceptedAt: isoDateTime.optional(),
  /** Explicit opt-in to store discomfort details and clinician instructions. */
  healthDetails: z.boolean().default(false),
  /** Optional cycle / pregnancy / menopause content. Off unless chosen. */
  lifeStageContent: z.boolean().default(false),
  /** Which categories the AI Coach may see. Empty = no personal context. */
  aiContext: z.array(z.enum(AI_CONTEXT_CATEGORIES)).default([]),
  analytics: z.boolean().default(false),
});
export type Consent = z.infer<typeof consentSchema>;

export const profileSchema = z.object({
  displayName: shortText.min(1),
  birthDate: dayKeySchema.optional(),
  heightCm: z.number().min(50).max(272).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  calcSex: calcSexSchema.optional(),
  pronouns: shortText.optional(),
  units: z.enum(['metric', 'imperial']).default('metric'),
  timeZone: z.string().max(64).optional(),
  experience: z.enum(EXPERIENCE).default('beginner'),
  goals: z.array(z.enum(GOALS)).max(4).default([]),
  primaryGoal: z.enum(GOALS).optional(),
  equipment: z.array(z.enum(EQUIPMENT)).default(['bodyweight']),
  trainingLocation: z.enum(['gym', 'home', 'outdoors', 'mixed']).default('mixed'),
  trainingDays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  sessionMinutes: z.number().int().min(10).max(180).default(45),
  preferredExerciseIds: z.array(z.string().max(64)).max(100).default([]),
  avoidedExerciseIds: z.array(z.string().max(64)).max(100).default([]),
  dietPreference: z.enum(DIET_PREFERENCES).default('none'),
  allergies: z.array(shortText).max(20).default([]),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).default('light'),
  sleepTargetHours: z.number().min(4).max(12).default(8),
  theme: z.enum(['system', 'dark', 'light']).default('dark'),
  consent: consentSchema.default({ healthDetails: false, lifeStageContent: false, aiContext: [], analytics: false }),
  onboardingCompletedAt: isoDateTime.optional(),
  updatedAt: isoDateTime,
});
export type Profile = z.infer<typeof profileSchema>;

export const goalRecordSchema = z.object({
  id: z.string(),
  goal: z.enum(GOALS),
  title: shortText.min(1),
  metric: z.enum(['weight', 'waist', 'workouts_per_week', 'lift_1rm', 'custom']).optional(),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  targetDate: dayKeySchema.optional(),
  exerciseId: z.string().optional(),
  milestones: z
    .array(z.object({ label: shortText, value: z.number(), reachedAt: isoDateTime.optional() }))
    .max(12)
    .default([]),
  status: z.enum(['active', 'achieved', 'archived']).default('active'),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type GoalRecord = z.infer<typeof goalRecordSchema>;
