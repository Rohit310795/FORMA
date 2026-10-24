/**
 * Offline sync rules shared by the app's outbox and its tests.
 *
 * - Every record has a client-generated id, so retries write the same document
 *   (no duplicates).
 * - Conflicts resolve by `revision`, then `updatedAt`; a completed workout is
 *   never replaced by an older in-progress copy.
 */

export interface Versioned {
  id: string;
  revision?: number;
  updatedAt: string;
  status?: string;
}

const TERMINAL = new Set(['completed', 'abandoned']);

export function resolveConflict<T extends Versioned>(local: T, remote: T | undefined): { winner: 'local' | 'remote'; value: T } {
  if (!remote) return { winner: 'local', value: local };
  // Never let a stale in-progress copy overwrite a finished session.
  if (remote.status && TERMINAL.has(remote.status) && local.status && !TERMINAL.has(local.status)) {
    return { winner: 'remote', value: remote };
  }
  const lr = local.revision ?? 0;
  const rr = remote.revision ?? 0;
  if (lr !== rr) return lr > rr ? { winner: 'local', value: local } : { winner: 'remote', value: remote };
  return local.updatedAt >= remote.updatedAt ? { winner: 'local', value: local } : { winner: 'remote', value: remote };
}

export interface OutboxItem {
  /** Collection path relative to the user, e.g. "workoutSessions". */
  collection: string;
  id: string;
  op: 'upsert' | 'delete';
  data?: Record<string, unknown>;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

/** Coalesces queued operations so only the latest op per document is sent. */
export function coalesceOutbox(items: OutboxItem[]): OutboxItem[] {
  const map = new Map<string, OutboxItem>();
  for (const item of items) {
    const key = `${item.collection}/${item.id}`;
    const prev = map.get(key);
    map.set(key, prev ? { ...item, attempts: Math.max(prev.attempts, item.attempts) } : item);
  }
  return [...map.values()];
}

/** Exponential backoff with a cap, in ms. */
export function retryDelayMs(attempts: number): number {
  return Math.min(5 * 60_000, 1000 * 2 ** Math.min(attempts, 8));
}
