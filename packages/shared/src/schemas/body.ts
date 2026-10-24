import { z } from 'zod';
import { baseRecord, dayKeySchema, shortText } from './common';

export const MEASUREMENT_SITES = [
  'chest',
  'waist',
  'hips',
  'shoulders',
  'neck',
  'upperArmLeft',
  'upperArmRight',
  'forearmLeft',
  'forearmRight',
  'thighLeft',
  'thighRight',
  'calfLeft',
  'calfRight',
] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];
export const MEASUREMENT_LABELS: Record<MeasurementSite, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  shoulders: 'Shoulders',
  neck: 'Neck',
  upperArmLeft: 'Upper arm (L)',
  upperArmRight: 'Upper arm (R)',
  forearmLeft: 'Forearm (L)',
  forearmRight: 'Forearm (R)',
  thighLeft: 'Thigh (L)',
  thighRight: 'Thigh (R)',
  calfLeft: 'Calf (L)',
  calfRight: 'Calf (R)',
};

export const bodyMeasurementSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  weightKg: z.number().min(20).max(400).optional(),
  /** Circumferences in cm. */
  sites: z.partialRecord(z.enum(MEASUREMENT_SITES), z.number().min(5).max(250)).default({}),
  bodyFatPercent: z.number().min(2).max(70).optional(),
  /** How body fat was estimated — shown next to the number so it is never over-trusted. */
  bodyFatMethod: z.enum(['scale_bia', 'calipers', 'dexa', 'visual_estimate', 'other']).optional(),
  note: shortText.optional(),
});
export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;

export const progressPhotoSchema = baseRecord.extend({
  dayKey: dayKeySchema,
  pose: z.enum(['front', 'side', 'back', 'other']).default('front'),
  /** Path inside the private Storage bucket: users/{uid}/progressPhotos/{file}. */
  storagePath: z.string().max(300),
  note: shortText.optional(),
});
export type ProgressPhoto = z.infer<typeof progressPhotoSchema>;
