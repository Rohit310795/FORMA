import * as fnLogger from 'firebase-functions/logger';
import { redactObject } from '@forma/shared';

/**
 * Structured, redacted logging. Never pass message content, health data or
 * credentials — pass ids, classes and counts. Everything is redacted again here.
 */
type Fields = Record<string, unknown>;
const emit = (level: 'info' | 'warn' | 'error', msg: string, fields?: Fields) => {
  const safe = fields ? (redactObject(fields) as Fields) : undefined;
  fnLogger[level](msg, safe ?? {});
};

export const logger = {
  info: (msg: string, fields?: Fields) => emit('info', msg, fields),
  warn: (msg: string, fields?: Fields) => emit('warn', msg, fields),
  error: (msg: string, fields?: Fields) => emit('error', msg, fields),
};
