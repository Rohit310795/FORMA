import { z } from 'zod';
import { baseRecord, dayKeySchema, shortText } from './common';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const macroSchema = z.object({
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(2000),
  fatG: z.number().min(0).max(1000),
  fibreG: z.number().min(0).max(300).optional(),
});
export type Macros = z.infer<typeof macroSchema>;

export const foodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  cuisine: z.enum(['indian', 'international']),
  serving: z.string(),
  servingGrams: z.number().positive().optional(),
  per: macroSchema,
  tags: z.array(z.string()).default([]),
  /** Always 'approximate' for the starter database: values vary by recipe and portion. */
  accuracy: z.enum(['approximate', 'label', 'database']),
  sourceNote: z.string(),
});
export type FoodItem = z.infer<typeof foodItemSchema>;

export const nutritionEntrySchema = baseRecord.extend({
  dayKey: dayKeySchema,
  meal: z.enum(MEALS),
  name: shortText.min(1),
  foodId: z.string().max(64).optional(),
  servings: z.number().min(0.1).max(20).default(1),
  macros: macroSchema,
  /** True when the values are an estimate (starter DB or user guess). */
  estimated: z.boolean().default(true),
});
export type NutritionEntry = z.infer<typeof nutritionEntrySchema>;

export const savedMealSchema = baseRecord.extend({
  name: shortText.min(1),
  items: z
    .array(z.object({ name: shortText, foodId: z.string().optional(), servings: z.number(), macros: macroSchema }))
    .min(1)
    .max(20),
});
export type SavedMeal = z.infer<typeof savedMealSchema>;

export const nutritionTargetsSchema = z.object({
  kcal: z.number().min(1000).max(6000),
  proteinG: z.number().min(0).max(400),
  carbsG: z.number().min(0).max(800),
  fatG: z.number().min(0).max(300),
  waterMl: z.number().min(500).max(6000),
  /** 'calculated' targets come from calc/energy; 'custom' means the user edited them. */
  mode: z.enum(['calculated', 'custom']).default('calculated'),
  updatedAt: z.string(),
});
export type NutritionTargets = z.infer<typeof nutritionTargetsSchema>;
