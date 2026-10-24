import { getAuth, type Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

/** Web: Firebase uses IndexedDB/localStorage persistence by default. */
export function createAuth(app: FirebaseApp): Auth {
  return getAuth(app);
}
