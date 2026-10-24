import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDoc, limit as qLimit, onSnapshot, orderBy, query, setDoc, type DocumentData } from 'firebase/firestore';
import { resolveConflict, type OutboxItem } from '@forma/shared';
import { db } from './firebase';
import { Outbox, type OutboxState } from './outbox';
import { useAuth } from './auth';

/** Collections whose edits can conflict across devices; resolved by revision/status. */
const VERSIONED = new Set(['workoutSessions', 'workoutPlans']);

function makeWriter(uid: string) {
  return async (item: OutboxItem) => {
    const ref = doc(db, `users/${uid}/${item.collection}/${item.id}`);
    if (item.op === 'delete') return deleteDoc(ref);
    const data = item.data as DocumentData;
    if (VERSIONED.has(item.collection)) {
      const remote = await getDoc(ref);
      if (remote.exists()) {
        const r = resolveConflict(data as never, remote.data() as never);
        if (r.winner === 'remote') return; // a newer or finished copy is already on the server
      }
    }
    await setDoc(ref, data);
  };
}

interface DataCtx {
  uid: string;
  outbox: Outbox;
}
const DataContext = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const outbox = useMemo(() => (uid ? new Outbox(AsyncStorage, `forma:outbox:${uid}`, makeWriter(uid)) : undefined), [uid]);

  useEffect(() => {
    if (!outbox) return;
    void outbox.flush();
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void outbox.flush();
    });
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void outbox.flush();
    });
    return () => {
      net();
      app.remove();
    };
  }, [outbox]);

  if (!uid || !outbox) return <>{children}</>;
  return <DataContext.Provider value={{ uid, outbox }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used when signed in');
  return ctx;
}

const EMPTY: OutboxState = { pending: [], syncing: false };
export function useSyncState(): OutboxState {
  const ctx = useContext(DataContext);
  return useSyncExternalStore(ctx?.outbox.subscribe ?? (() => () => {}), ctx?.outbox.getState ?? (() => EMPTY), ctx?.outbox.getState ?? (() => EMPTY));
}

export type WithPending<T> = T & { _pending?: boolean };

/** Live collection under the user, with unsynced local writes overlaid (marked `_pending`). */
export function useCollection<T extends { id: string }>(name: string, opts: { orderBy?: string; direction?: 'asc' | 'desc'; limit?: number } = {}) {
  const { uid } = useData();
  const sync = useSyncState();
  const field = opts.orderBy ?? 'createdAt';
  const direction = opts.direction ?? 'desc';
  const max = opts.limit ?? 200;
  const queryKey = `${uid}/${name}/${field}/${direction}/${max}`;
  const [snapshot, setSnapshot] = useState<{ key: string; items: T[]; error?: string }>();

  useEffect(() => {
    const q = query(collection(db, `users/${uid}/${name}`), orderBy(field, direction), qLimit(max));
    return onSnapshot(
      q,
      (snap) => setSnapshot({ key: queryKey, items: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id })) }),
      () => setSnapshot((s) => ({ key: queryKey, items: s?.key === queryKey ? s.items : [], error: 'Couldn’t load the latest data. Showing what’s saved on this device.' })),
    );
  }, [uid, name, field, direction, max, queryKey]);
  const current = snapshot?.key === queryKey ? snapshot : undefined;
  const remote = useMemo(() => current?.items ?? [], [current]);
  const loading = !current;
  const error = current?.error;

  const items = useMemo(() => {
    const pending = sync.pending.filter((p) => p.collection === name);
    if (!pending.length) return remote as WithPending<T>[];
    const map = new Map<string, WithPending<T>>(remote.map((r) => [r.id, r]));
    for (const p of pending) {
      if (p.op === 'delete') map.delete(p.id);
      else map.set(p.id, { ...(p.data as T), _pending: true });
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const av = String((a as Record<string, unknown>)[field] ?? '');
      const bv = String((b as Record<string, unknown>)[field] ?? '');
      return direction === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv);
    });
    return list;
  }, [remote, sync.pending, name, field, direction]);

  return { items, loading: loading && !items.length, error };
}

/** Single document under the user (e.g. profile/main, settings/healthSync), with pending overlay. */
export function useUserDoc<T>(collectionName: string, id: string) {
  const { uid } = useData();
  const sync = useSyncState();
  const path = `users/${uid}/${collectionName}/${id}`;
  const [snapshot, setSnapshot] = useState<{ path: string; data?: T }>();
  useEffect(
    () =>
      onSnapshot(
        doc(db, path),
        (snap) => setSnapshot({ path, data: snap.exists() ? (snap.data() as T) : undefined }),
        () => setSnapshot({ path }),
      ),
    [path],
  );
  const current = snapshot?.path === path ? snapshot : undefined;
  const remote = current?.data;
  const loading = !current;
  const pending = [...sync.pending].reverse().find((p) => p.collection === collectionName && p.id === id && p.op === 'upsert');
  return { data: (pending?.data as T | undefined) ?? remote, loading: loading && !pending, pending: Boolean(pending) };
}

export function useMutations() {
  const { outbox } = useData();
  return useMemo(
    () => ({
      save: (collectionName: string, id: string, data: object) => outbox.enqueue({ collection: collectionName, id, op: 'upsert', data: JSON.parse(JSON.stringify(data)) }),
      remove: (collectionName: string, id: string) => outbox.enqueue({ collection: collectionName, id, op: 'delete' }),
      flush: () => outbox.flush(),
    }),
    [outbox],
  );
}
