import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { deleteUser, type User } from 'firebase/auth';
import { db } from './firebase';

/**
 * Client-side export / deletion used on the free (Spark) setup where Cloud
 * Functions aren't available. Everything runs with the user's own
 * permissions; Security Rules still restrict it to their data.
 */
export const USER_COLLECTIONS = [
  'goals', 'bodyMeasurements', 'progressPhotos', 'workoutPlans', 'workoutSessions', 'nutritionLogs', 'savedMeals',
  'hydrationLogs', 'sleepLogs', 'recoveryCheckIns', 'discomfortLogs', 'clinicianInstructions', 'mobilitySessions',
  'supplementInventory', 'wellnessRoutines',
] as const;
const SETTINGS_DOCS = ['healthSync', 'notifications', 'nutritionTargets', 'musclePriorities'] as const;

export async function exportOwnData(uid: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), source: 'device (free setup)' };
  out.profile = (await getDoc(doc(db, `users/${uid}/profile/main`))).data() ?? null;
  const settings: Record<string, unknown> = {};
  for (const s of SETTINGS_DOCS) settings[s] = (await getDoc(doc(db, `users/${uid}/settings/${s}`))).data() ?? null;
  out.settings = settings;
  for (const c of USER_COLLECTIONS) out[c] = (await getDocs(collection(db, `users/${uid}/${c}`))).docs.map((d) => ({ id: d.id, ...d.data() }));
  const convs = await getDocs(collection(db, `users/${uid}/aiConversations`));
  out.aiConversations = await Promise.all(
    convs.docs.map(async (c) => ({ id: c.id, ...c.data(), messages: (await getDocs(query(collection(c.ref, 'messages'), orderBy('createdAt')))).docs.map((m) => ({ id: m.id, ...m.data() })) })),
  );
  return out;
}

export class RecentLoginRequired extends Error {}

/** Deletes all of the user's documents, then the Auth account. Requires a sign-in within the last 5 minutes. */
export async function deleteOwnAccount(user: User): Promise<void> {
  const last = Date.parse(user.metadata.lastSignInTime ?? '');
  if (!last || Date.now() - last > 5 * 60_000) throw new RecentLoginRequired('Please sign in again to confirm.');
  const uid = user.uid;
  for (const c of USER_COLLECTIONS) {
    for (const d of (await getDocs(collection(db, `users/${uid}/${c}`))).docs) await deleteDoc(d.ref);
  }
  for (const c of (await getDocs(collection(db, `users/${uid}/aiConversations`))).docs) {
    for (const m of (await getDocs(collection(c.ref, 'messages'))).docs) await deleteDoc(m.ref);
    await deleteDoc(c.ref);
  }
  for (const s of SETTINGS_DOCS) await deleteDoc(doc(db, `users/${uid}/settings/${s}`));
  await deleteDoc(doc(db, `users/${uid}/profile/main`));
  await deleteUser(user);
}
