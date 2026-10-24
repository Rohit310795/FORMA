import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import { ZodError } from 'zod';
import { logger } from './logger';

/** An error whose message is safe to show to the caller. */
export class PublicError extends Error {
  constructor(public code: FunctionsErrorCode, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

/** Maps any thrown value to an HttpsError without leaking internals. */
export function toPublicError(err: unknown, requestId: string): HttpsError {
  if (err instanceof HttpsError) return err;
  if (err instanceof PublicError) return new HttpsError(err.code, err.message, { requestId, ...err.details });
  if (err instanceof ZodError) {
    const issues = err.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message }));
    return new HttpsError('invalid-argument', 'Some fields are invalid.', { requestId, issues });
  }
  logger.error('unhandled_error', { requestId, name: (err as Error)?.name, message: (err as Error)?.message });
  return new HttpsError('internal', 'Something went wrong. Please try again.', { requestId });
}
