# Setup, deployment & operations (plain-English guide)

## 1. Run everything locally (no cloud account needed)

Requirements: Node 22, Java 21 (for the Firebase emulators).

```bash
npm install                      # once
npm run build:functions          # bundle the backend
npx firebase emulators:start --only auth,firestore,functions,storage --project demo-forma
```

In a second terminal:

```bash
cd apps/mobile && npx expo start        # press w for web, or scan with a dev build
cd apps/admin  && npm run dev           # admin console at http://localhost:3000/admin
```

Without a `.env`, both apps automatically use the emulators. The Emulator UI is at http://127.0.0.1:4000.

**Create a local owner:** sign up in the app or the Auth emulator UI, then:

```bash
cd functions
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npm run bootstrap-owner -- --email you@example.com --project demo-forma
```

In the emulator, AI keys are kept in a dev-only store (`_devSecrets`). Real AI calls need a real key and outbound internet access.

## 2. Create the Firebase project (one time)

1. In the [Firebase console](https://console.firebase.google.com) create a project (e.g. `forma-prod`, plus `forma-dev` / `forma-staging` if you want separate environments).
2. Upgrade to the **Blaze** plan (Cloud Functions and Secret Manager need it). Set a billing budget alert in Google Cloud.
3. **Authentication → Sign-in method:** enable Email/Password. Optionally enable Google and Apple (see §5).
4. **Firestore Database:** create it in production mode, in a region near your users (e.g. `asia-south1`).
5. **Storage:** create the default bucket.
6. **Project settings → Your apps:** add a **Web app**. Copy its config into `apps/mobile/.env` and `apps/admin/.env.local` (see the `.env.example` files).
7. In Google Cloud console → APIs: enable **Secret Manager API**. In IAM, give the Cloud Functions runtime service account (usually `PROJECT_NUMBER-compute@developer.gserviceaccount.com`) the role **Secret Manager Admin** (needed to create, rotate and disable provider keys).
8. Copy `.firebaserc.example` to `.firebaserc` and put your project ids in it.

## 3. Deploy

```bash
npx firebase login
cp functions/.env.example functions/.env       # fill in values (no AI keys here)
npm run build:admin                             # static admin console → apps/admin/out
npx firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting --project forma-prod
```

- The admin console is served by Firebase Hosting at `https://<project>.web.app/admin`.
- Set `FUNCTIONS_REGION` in `functions/.env` and `EXPO_PUBLIC_FUNCTIONS_REGION` / `NEXT_PUBLIC_FUNCTIONS_REGION` to the same region.
- After the first deploy, enable the TTL policies if the console asks you to confirm them (Firestore → TTL).

## 4. Create the owner account (one time, secure)

1. Sign up in the app or the admin console login page with the owner's email. (Normal sign-up — there's no admin sign-up.)
2. In Firebase console → Project settings → Service accounts → **Generate new private key**. Keep the file private, outside the repo.
3. Run:
   ```bash
   cd functions
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json \
     npm run bootstrap-owner -- --email owner@yourdomain.com --project forma-prod
   ```
4. Sign out and back in to the admin console. Delete the key file when finished, or revoke the key in Google Cloud.
5. Add more people from Admin Console → Admins.

## 5. Configure AI (no code changes)

1. Admin Console → **AI Providers → Add provider** (OpenAI, Google Gemini, Anthropic or any OpenAI-compatible service).
2. Add the models you want, using the provider's exact model ids. Mark `json` for models that support structured output. Enter per-million-token prices from the provider's pricing page to get cost estimates.
3. Paste the API key and keep “Test connection before saving” on. The key goes to Secret Manager.
4. **Feature AI Routing:** choose a primary model and fallbacks for each feature. Workout generation requires a JSON-capable model.
5. **AI Usage & Costs → Budgets:** set daily/monthly limits and what happens when they're reached.
6. Optional: **Prompts & Policies** to tune tone (safety rules stay in code).

To **rotate** a key, paste a new one. To **disable** a compromised key, click “Disable key (compromised)” — AI requests skip that provider immediately (fallbacks still work).

## 6. Mobile builds (iOS / Android)

The app uses native modules (HealthKit, Apple sign-in, notifications), so use **development builds**, not Expo Go:

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform ios     # or android
```

- Change `ios.bundleIdentifier` / `android.package` in `app.json` from `com.example.forma` to your own ids.
- **Apple Sign-In:** enable the capability for your App ID in the Apple Developer portal, add Apple as a provider in Firebase Auth (Service ID, Team ID, Key ID, private key — keep the key out of the repo).
- **Google Sign-In:** create OAuth client IDs (iOS, Android, Web) in Google Cloud and put them in `apps/mobile/.env`.
- **HealthKit:** see [HEALTHKIT.md](HEALTHKIT.md).
- Store releases: `eas build --profile production` then `eas submit`.

## 7. Backups & recovery

- Turn on **Firestore point-in-time recovery** and scheduled **managed exports** (Firestore → Disaster recovery / `gcloud firestore export gs://<bucket>`). A daily export with 30-day retention is a sensible start.
- Storage: enable Object Versioning on the bucket, or replicate it, to protect progress photos.
- Secret Manager keeps disabled versions. To recover from a bad rotation, re-enable the previous version in the Cloud console.
- Configuration (flags, routes, prompts, plans, settings) is stored in Firestore and included in exports. Every change is in the audit log.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| App shows “AI is temporarily unavailable” | No route for that feature, provider disabled, key missing or disabled, budget reached, or provider down. Check Overview → AI providers and AI Usage. |
| Admin console says “No access” | The account has no `role` claim. Run the bootstrap script (first owner) or ask the owner to grant a role, then sign out and in. |
| `permission-denied` writing discomfort logs | The user hasn't enabled health-detail storage (Settings → Privacy). |
| Password-reset from console fails | Set `FORMA_WEB_API_KEY` in `functions/.env` and redeploy. |
| Changes in the console take a moment to apply | Function instances cache configuration for up to 15 seconds. |
| “Waiting to sync” doesn't clear | The device is offline or a write was rejected; the outbox retries with backoff. Errors are visible in the sync chip. |
| Emulator port errors | Make sure ports 4000, 5001, 8080, 9099 and 9199 are free. |
