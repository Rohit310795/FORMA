/**
 * Public, non-secret client configuration. Firebase web config values are
 * identifiers, not secrets; access is protected by Security Rules and App Check.
 * NEVER put API keys for AI providers or any other secret in EXPO_PUBLIC_* vars.
 */
export const env = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-forma.firebaseapp.com',
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-forma',
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'demo-forma.appspot.com',
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  },
  functionsRegion: process.env.EXPO_PUBLIC_FUNCTIONS_REGION ?? 'asia-south1',
  useEmulators: (process.env.EXPO_PUBLIC_USE_EMULATORS ?? (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ? 'false' : 'true')) === 'true',
  emulatorHost: process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '127.0.0.1',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  /**
   * 'off' = free (Firebase Spark) setup: no Cloud Functions, so AI, server
   * feature flags and server-side export/deletion are replaced by safe
   * client-side alternatives or a clear "not available" message.
   */
  serverFeatures: (process.env.EXPO_PUBLIC_SERVER_FEATURES ?? 'on') !== 'off',
  /** 'off' when the project has no Cloud Storage bucket (Spark projects created after Oct 2024). */
  storageEnabled: (process.env.EXPO_PUBLIC_STORAGE_ENABLED ?? 'on') !== 'off',
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
};
