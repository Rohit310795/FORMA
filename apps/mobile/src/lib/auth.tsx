import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  OAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { auth } from './firebase';

interface AuthState {
  user: User | null;
  initializing: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signInWithApple(): Promise<void>;
  signInWithGoogleIdToken(idToken: string): Promise<void>;
  signInWithGoogleWeb(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [initializing, setInitializing] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setInitializing(false);
      }),
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async signUp(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName) await updateProfile(cred.user, { displayName });
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },
      async signInWithApple() {
        if (Platform.OS === 'web') {
          await signInWithPopup(auth, new OAuthProvider('apple.com'));
          return;
        }
        // Nonce protects against replay: Apple signs the hash, Firebase checks the raw value.
        const rawNonce = Crypto.randomUUID();
        const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        const apple = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashed,
        });
        if (!apple.identityToken) throw new Error('Apple sign-in did not return a token.');
        const credential = new OAuthProvider('apple.com').credential({ idToken: apple.identityToken, rawNonce });
        await signInWithCredential(auth, credential);
      },
      async signInWithGoogleIdToken(idToken) {
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      },
      async signInWithGoogleWeb() {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, initializing],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Friendly, non-leaky messages for Firebase Auth error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Please enter your password.',
    'auth/weak-password': 'Use at least 8 characters for your password.',
    'auth/email-already-in-use': 'An account already exists for that email. Try signing in.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/user-disabled': 'This account is suspended. Please contact support.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'You appear to be offline. Check your connection and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/operation-not-allowed': 'This sign-in method isn’t enabled yet.',
    ERR_REQUEST_CANCELED: 'Sign-in was cancelled.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}
