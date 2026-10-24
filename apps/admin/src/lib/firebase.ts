'use client';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

/** Public Firebase web config — identifiers, not secrets. */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-forma.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-forma',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};
const useEmulators = (process.env.NEXT_PUBLIC_USE_EMULATORS ?? (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'false' : 'true')) === 'true';
const host = process.env.NEXT_PUBLIC_EMULATOR_HOST ?? '127.0.0.1';

const first = !getApps().length;
export const app = first ? initializeApp(config) : getApp();
export const auth = getAuth(app);
export const functions = getFunctions(app, process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? 'asia-south1');
if (first && useEmulators && typeof window !== 'undefined') {
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFunctionsEmulator(functions, host, 5001);
}
export const usingEmulators = useEmulators;

const adminCallable = httpsCallable<{ action: string; payload?: unknown }, unknown>(functions, 'adminApi', { timeout: 60_000 });

/** The only way the console reaches data. The server re-checks role and permission on every call. */
export async function adminCall<T = unknown>(action: string, payload: unknown = {}): Promise<T> {
  const res = await adminCallable({ action, payload: JSON.parse(JSON.stringify(payload ?? {})) });
  return res.data as T;
}

export function errorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string; details?: { issues?: { path: string; message: string }[] } };
  if (e?.details?.issues?.length) return `${e.message} ${e.details.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`;
  if (e?.code === 'functions/permission-denied') return 'You do not have access to this action.';
  if (e?.code === 'functions/unauthenticated') return 'Please sign in again.';
  return e?.message || 'Something went wrong.';
}
