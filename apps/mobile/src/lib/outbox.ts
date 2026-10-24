import { coalesceOutbox, retryDelayMs, type OutboxItem } from '@forma/shared';

/**
 * Persistent offline outbox. Every user write goes here first, is saved to
 * device storage, and is sent when the network allows. An item is only
 * removed (and shown as synced) after the backend confirms the write.
 * Pure TypeScript with injected storage/writer so it is unit-testable.
 */

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type Writer = (item: OutboxItem) => Promise<void>;

export interface OutboxState {
  pending: OutboxItem[];
  syncing: boolean;
  lastSyncedAt?: string;
  lastError?: string;
}

export class Outbox {
  private state: OutboxState = { pending: [], syncing: false };
  private listeners = new Set<() => void>();
  private loaded = false;
  private flushing?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private storage: KeyValueStore,
    private key: string,
    private writer: Writer,
    private opts: { writeTimeoutMs?: number; now?: () => Date; schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> } = {},
  ) {}

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<OutboxState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async load() {
    if (this.loaded) return;
    const raw = await this.storage.getItem(this.key);
    const saved = raw ? (JSON.parse(raw) as Partial<OutboxState>) : {};
    this.loaded = true;
    this.set({ pending: coalesceOutbox([...(saved.pending ?? []), ...this.state.pending]), lastSyncedAt: saved.lastSyncedAt });
  }

  private async persist() {
    await this.storage.setItem(this.key, JSON.stringify({ pending: this.state.pending, lastSyncedAt: this.state.lastSyncedAt }));
  }

  /** Queues a write and persists it before returning, then tries to send it. */
  async enqueue(item: Omit<OutboxItem, 'enqueuedAt' | 'attempts'>) {
    await this.load();
    const now = (this.opts.now?.() ?? new Date()).toISOString();
    this.set({ pending: coalesceOutbox([...this.state.pending, { ...item, enqueuedAt: now, attempts: 0 }]) });
    await this.persist();
    void this.flush();
  }

  /** Sends queued writes in order. Safe to call often; concurrent calls share one run. */
  flush(): Promise<void> {
    if (!this.flushing) this.flushing = this.runFlush().finally(() => (this.flushing = undefined));
    return this.flushing;
  }

  private async runFlush() {
    await this.load();
    if (!this.state.pending.length) return;
    this.set({ syncing: true });
    const timeout = this.opts.writeTimeoutMs ?? 15000;
    const attempted = new Set<string>();
    // Keep going until the queue is drained: items enqueued during this run are picked up too.
    outer: while (true) {
      const next = this.state.pending.filter((p) => !attempted.has(`${p.collection}/${p.id}@${p.enqueuedAt}`));
      if (!next.length) break;
      for (const item of next) {
        attempted.add(`${item.collection}/${item.id}@${item.enqueuedAt}`);
        try {
          await Promise.race([
            this.writer(item),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Write timed out (offline?)')), timeout)),
          ]);
          // Confirmed by the backend — only now is it removed. A newer queued version of the same doc stays.
          this.set({
            pending: this.state.pending.filter((p) => !(p.collection === item.collection && p.id === item.id && p.enqueuedAt === item.enqueuedAt)),
            lastSyncedAt: (this.opts.now?.() ?? new Date()).toISOString(),
            lastError: undefined,
          });
        } catch (err) {
          const message = (err as Error)?.message ?? 'Sync failed';
          this.set({
            pending: this.state.pending.map((p) => (p.collection === item.collection && p.id === item.id ? { ...p, attempts: p.attempts + 1, lastError: message } : p)),
            lastError: message,
          });
          // Stop on the first failure to preserve write order; retry with backoff.
          const delay = retryDelayMs(item.attempts + 1);
          if (this.timer) clearTimeout(this.timer);
          this.timer = (this.opts.schedule ?? setTimeout)(() => void this.flush(), delay);
          break outer;
        }
      }
    }
    await this.persist();
    this.set({ syncing: false });
  }

  /** Data waiting to sync, used to overlay unsynced records on screen. */
  pendingFor(collection: string) {
    return this.state.pending.filter((p) => p.collection === collection);
  }
}
