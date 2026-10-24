import { describe, expect, it } from 'vitest';
import { Outbox, type KeyValueStore } from '../src/lib/outbox';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) };
};
const noSchedule = () => setTimeout(() => {}, 0);

describe('offline outbox', () => {
  it('persists before sending and only clears after the backend confirms', async () => {
    const store = memory();
    let online = false;
    const written: string[] = [];
    const box = new Outbox(store, 'k', async (item) => {
      if (!online) throw new Error('offline');
      written.push(item.id);
    }, { schedule: noSchedule });
    await box.enqueue({ collection: 'workoutSessions', id: 's1', op: 'upsert', data: { v: 1 } });
    await box.flush();
    expect(box.getState().pending).toHaveLength(1);
    expect(box.getState().lastSyncedAt).toBeUndefined();
    expect(JSON.parse(store.data.get('k')!).pending).toHaveLength(1);
    online = true;
    await box.flush();
    expect(written).toEqual(['s1']);
    expect(box.getState().pending).toHaveLength(0);
    expect(box.getState().lastSyncedAt).toBeDefined();
  });

  it('survives an app restart', async () => {
    const store = memory();
    const a = new Outbox(store, 'k', async () => { throw new Error('offline'); }, { schedule: noSchedule });
    await a.enqueue({ collection: 'hydrationLogs', id: 'h1', op: 'upsert', data: { ml: 250 } });
    await a.flush();
    const sent: string[] = [];
    const b = new Outbox(store, 'k', async (i) => void sent.push(i.id), { schedule: noSchedule });
    await b.flush();
    expect(sent).toEqual(['h1']);
  });

  it('coalesces repeated edits of the same record into one write (no duplicates)', async () => {
    const store = memory();
    let online = false;
    const sent: unknown[] = [];
    const box = new Outbox(store, 'k', async (i) => { if (!online) throw new Error('offline'); sent.push(i.data); }, { schedule: noSchedule });
    await box.enqueue({ collection: 'workoutSessions', id: 's1', op: 'upsert', data: { sets: 1 } });
    await box.enqueue({ collection: 'workoutSessions', id: 's1', op: 'upsert', data: { sets: 2 } });
    await box.enqueue({ collection: 'workoutSessions', id: 's1', op: 'upsert', data: { sets: 3 } });
    await box.flush();
    online = true;
    await box.flush();
    expect(sent).toEqual([{ sets: 3 }]);
  });

  it('times out hung writes and keeps them queued', async () => {
    const box = new Outbox(memory(), 'k', () => new Promise(() => {}), { writeTimeoutMs: 20, schedule: noSchedule });
    await box.enqueue({ collection: 'sleepLogs', id: 'x', op: 'upsert', data: {} });
    await box.flush();
    expect(box.getState().pending[0]?.attempts).toBeGreaterThan(0);
    expect(box.getState().lastError).toMatch(/timed out/);
  });
});

describe('outbox concurrency', () => {
  it('sends items enqueued while a flush is already running', async () => {
    const sent: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const box = new Outbox(memory(), 'k', async (i) => {
      if (i.id === 'a') await gate;
      sent.push(i.id);
    }, { schedule: noSchedule });
    await box.enqueue({ collection: 'x', id: 'a', op: 'upsert', data: {} });
    await box.enqueue({ collection: 'x', id: 'b', op: 'upsert', data: {} });
    release();
    // No further flush() calls: the original run must pick up 'b' on its own.
    await new Promise((r) => setTimeout(r, 30));
    expect(sent).toEqual(['a', 'b']);
    expect(box.getState().pending).toHaveLength(0);
  });
});
