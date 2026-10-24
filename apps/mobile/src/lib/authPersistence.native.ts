import { initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import * as firebaseAuthRN from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';

// `getReactNativePersistence` is exported only by @firebase/auth's React Native build
// (selected by Metro's "react-native" export condition). The package's top-level
// `types` entry hides it from TypeScript, hence the typed access.
const { getReactNativePersistence } = firebaseAuthRN as unknown as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

/** Native: persist the session in AsyncStorage so users stay signed in. */
export function createAuth(app: FirebaseApp): Auth {
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}
