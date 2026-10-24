import { z } from 'zod';

export const isoDateTime = z.string().min(10).max(40);
export const dayKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');
export const shortText = z.string().trim().max(200);
export const longText = z.string().trim().max(4000);

/** Fields present on every user-owned record. `clientId` makes offline writes idempotent. */
export const baseRecord = z.object({
  id: idSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  /** Monotonic edit counter used for conflict resolution of offline edits. */
  revision: z.number().int().min(0).default(0),
  /** Where the data came from. Imported device data is never presented as self-reported. */
  source: z.enum(['manual', 'healthkit', 'ai_draft', 'template', 'import']).default('manual'),
});
