import { redactSecrets } from '@forma/shared';
import { db } from '../lib/firebase';
import { logger } from '../lib/logger';

export interface AuditEntry {
  actorUid: string;
  actorRole?: string;
  action: string;
  target?: string;
  outcome: 'success' | 'denied' | 'error';
  summary?: string;
  requestId?: string;
}

/** Append-only admin audit log. Summaries are redacted and must not contain health data. */
export async function audit(entry: AuditEntry): Promise<void> {
  const record = {
    ...entry,
    summary: entry.summary ? redactSecrets(entry.summary).slice(0, 2000) : undefined,
    at: new Date().toISOString(),
  };
  try {
    await db.collection('adminAuditLogs').add(Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)));
  } catch (err) {
    logger.error('audit_write_failed', { action: entry.action, message: (err as Error).message });
  }
}
