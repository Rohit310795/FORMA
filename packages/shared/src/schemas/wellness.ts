import { z } from 'zod';
import { baseRecord, dayKeySchema, isoDateTime, longText, shortText } from './common';

export const hydrationLogSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  ml: z.number().int().min(10).max(3000),
  at: isoDateTime,
});
export type HydrationLog = z.infer<typeof hydrationLogSchema>;

export const sleepLogSchema = baseRecord.extend({
  /** The day the user woke up. */
  dayKey: dayKeySchema,
  bedtime: isoDateTime.optional(),
  wakeTime: isoDateTime.optional(),
  durationMin: z.number().int().min(0).max(1440),
  /** 1–5, only for self-reported entries. */
  quality: z.number().int().min(1).max(5).optional(),
  /** Imported device stages, minutes. */
  stages: z
    .object({ deep: z.number().optional(), core: z.number().optional(), rem: z.number().optional(), awake: z.number().optional() })
    .optional(),
  note: shortText.optional(),
});
export type SleepLog = z.infer<typeof sleepLogSchema>;

export const recoveryCheckInSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  sleepHours: z.number().min(0).max(16).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  /** 1 = none … 5 = very sore. */
  soreness: z.number().int().min(1).max(5).optional(),
  fatigue: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  sorenessAreas: z.array(z.string().max(40)).max(20).default([]),
  discomfortReported: z.boolean().default(false),
  note: shortText.optional(),
});
export type RecoveryCheckIn = z.infer<typeof recoveryCheckInSchema>;

export const JOINTS = ['knee', 'hip', 'ankle', 'foot', 'shoulder', 'elbow', 'wrist', 'neck', 'upper_back', 'lower_back'] as const;
export type Joint = (typeof JOINTS)[number];

export const discomfortLogSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  joint: z.enum(JOINTS),
  side: z.enum(['left', 'right', 'both', 'na']).default('na'),
  location: z.enum(['front', 'back', 'inside', 'outside', 'unsure']).default('unsure'),
  /** 0–10 numeric rating. */
  severity: z.number().int().min(0).max(10),
  onset: z.enum(['sudden_injury', 'gradual', 'after_activity', 'unsure']).default('unsure'),
  durationDays: z.number().int().min(0).max(3650).optional(),
  aggravators: z.array(z.enum(['stairs', 'squatting', 'kneeling', 'running', 'jumping', 'sitting_long', 'walking', 'lifting', 'overhead', 'other'])).default([]),
  sharpPain: z.boolean().default(false),
  stiffness: z.boolean().default(false),
  swelling: z.enum(['none', 'mild', 'significant']).default('none'),
  locking: z.boolean().default(false),
  instability: z.enum(['none', 'occasional', 'substantial']).default('none'),
  /** True after a specific incident (fall, twist, impact). */
  recentInjury: z.boolean().default(false),
  canBearWeight: z.boolean().default(true),
  hotOrRed: z.boolean().default(false),
  feverOrUnwell: z.boolean().default(false),
  numbnessOrTingling: z.boolean().default(false),
  trend: z.enum(['better', 'same', 'worse', 'rapidly_worse', 'first_entry']).default('first_entry'),
  impact: z
    .object({ walking: z.number().int().min(0).max(3), stairs: z.number().int().min(0).max(3), exercise: z.number().int().min(0).max(3) })
    .partial()
    .default({}),
  triedSoFar: shortText.optional(),
  note: longText.optional(),
});
export type DiscomfortLog = z.infer<typeof discomfortLogSchema>;

/** Instructions a clinician gave the user, entered by the user. They always override app suggestions. */
export const clinicianInstructionSchema = baseRecord.extend({
  joint: z.enum(JOINTS).optional(),
  givenBy: shortText.optional(),
  givenOn: dayKeySchema.optional(),
  instructions: longText.min(1),
  avoidExerciseIds: z.array(z.string().max(64)).max(100).default([]),
  avoidTags: z.array(z.string().max(40)).max(30).default([]),
  active: z.boolean().default(true),
  reviewOn: dayKeySchema.optional(),
});
export type ClinicianInstruction = z.infer<typeof clinicianInstructionSchema>;

export const mobilitySessionSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  routineId: z.string().max(64),
  completedSteps: z.number().int().min(0).max(50),
  totalSteps: z.number().int().min(1).max(50),
  durationMin: z.number().int().min(0).max(240).optional(),
  discomfort: z.number().int().min(0).max(10).optional(),
});
export type MobilitySession = z.infer<typeof mobilitySessionSchema>;

export const supplementItemSchema = baseRecord.extend({
  name: shortText.min(1),
  brand: shortText.optional(),
  /** Link to an education entry in the reference library, if any. */
  referenceId: z.string().max(64).optional(),
  dose: shortText.optional(),
  timing: z.enum(['morning', 'pre_workout', 'post_workout', 'with_meals', 'evening', 'as_needed']).optional(),
  ingredientsNote: longText.optional(),
  note: shortText.optional(),
  trackConsistency: z.boolean().default(false),
  takenDays: z.array(dayKeySchema).max(62).default([]),
  active: z.boolean().default(true),
});
export type SupplementItem = z.infer<typeof supplementItemSchema>;

export const wellnessRoutineSchema = baseRecord.extend({
  kind: z.enum(['skincare_am', 'skincare_pm', 'habit', 'wind_down']),
  name: shortText.min(1),
  steps: z.array(z.object({ key: z.string().max(40), label: shortText.min(1) })).max(15),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** Recent completions only (bounded); full history lives in routineCompletions. */
  completedDays: z.array(dayKeySchema).max(62).default([]),
  active: z.boolean().default(true),
});
export type WellnessRoutine = z.infer<typeof wellnessRoutineSchema>;

export const healthSyncMetadataSchema = z.object({
  provider: z.literal('healthkit'),
  connected: z.boolean(),
  grantedTypes: z.array(z.string()).default([]),
  lastSyncAt: isoDateTime.optional(),
  lastSyncStatus: z.enum(['ok', 'partial', 'error', 'never']).default('never'),
  lastError: shortText.optional(),
  /** Anchors per type so the next sync only fetches changes. */
  anchors: z.record(z.string(), z.string()).default({}),
  updatedAt: isoDateTime,
});
export type HealthSyncMetadata = z.infer<typeof healthSyncMetadataSchema>;

export const REMINDER_CATEGORIES = ['workouts', 'hydration', 'sleep', 'recovery', 'milestones', 'habits'] as const;
export const notificationPreferencesSchema = z.object({
  permission: z.enum(['undetermined', 'granted', 'denied']).default('undetermined'),
  categories: z.partialRecord(z.enum(REMINDER_CATEGORIES), z.object({ enabled: z.boolean(), time: z.string().optional() })).default({}),
  /** Lock-screen text stays generic unless the user opts in. */
  showDetailsOnLockScreen: z.boolean().default(false),
  updatedAt: isoDateTime,
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
