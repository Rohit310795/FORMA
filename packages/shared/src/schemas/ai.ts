import { z } from 'zod';
import { AI_CONTEXT_CATEGORIES, AI_ROUTE_KEYS } from '../features';

export const chatRequestSchema = z.object({
  conversationId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/).optional(),
  routeKey: z.enum(AI_ROUTE_KEYS).default('coachChat'),
  message: z.string().trim().min(1).max(4000),
  /** Categories the user allows for THIS request (still capped by stored consent). */
  shareContext: z.array(z.enum(AI_CONTEXT_CATEGORIES)).max(AI_CONTEXT_CATEGORIES.length).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
  /** Assistant-only metadata. */
  safety: z.enum(['ok', 'modified', 'blocked', 'red_flag']).optional(),
  disclaimers: z.array(z.string()).optional(),
  degraded: z.boolean().optional(),
  feedback: z.enum(['up', 'down']).optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/** Structured output for AI workout generation. Validated server-side before reaching the user. */
export const generatedWorkoutSchema = z.object({
  name: z.string().min(1).max(80),
  summary: z.string().max(400),
  days: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        focus: z.string().max(80).optional(),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string().max(64),
              sets: z.number().int().min(1).max(6),
              repsMin: z.number().int().min(1).max(30),
              repsMax: z.number().int().min(1).max(30),
              restSec: z.number().int().min(30).max(300),
              note: z.string().max(140).optional(),
            }),
          )
          .min(1)
          .max(10),
      }),
    )
    .min(1)
    .max(6),
});
export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>;

/** JSON Schema mirror of generatedWorkoutSchema for providers' structured-output modes. */
export const generatedWorkoutJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'summary', 'days'],
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'focus', 'exercises'],
        properties: {
          name: { type: 'string' },
          focus: { type: 'string' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['exerciseId', 'sets', 'repsMin', 'repsMax', 'restSec', 'note'],
              properties: {
                exerciseId: { type: 'string' },
                sets: { type: 'integer' },
                repsMin: { type: 'integer' },
                repsMax: { type: 'integer' },
                restSec: { type: 'integer' },
                note: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const OUTPUT_SCHEMAS = {
  generatedWorkout: { zod: generatedWorkoutSchema, json: generatedWorkoutJsonSchema },
} as const;
export type OutputSchemaName = keyof typeof OUTPUT_SCHEMAS;
