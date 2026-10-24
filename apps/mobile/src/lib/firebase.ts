import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, memoryLocalCache } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { env } from './env';
import { createAuth } from './authPersistence';

const first = !getApps().length;
export const app = first ? initializeApp(env.firebase) : getApp();
export const auth = createAuth(app);
// Offline durability is handled by FORMA's own persistent outbox (lib/outbox), so the SDK cache stays in memory.
export const db = initializeFirestore(app, { localCache: memoryLocalCache(), ignoreUndefinedProperties: true });
export const functions = getFunctions(app, env.functionsRegion);
export const storage = getStorage(app);

if (first && env.useEmulators) {
  const host = env.emulatorHost;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
}
