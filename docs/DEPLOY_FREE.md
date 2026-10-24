# Publish FORMA for free (Firebase Spark plan + GitHub Actions)

This setup uses **only no-cost plans**. Your Firebase project stays on **Spark**, which has no billing account, so it can't charge you. If a free quota runs out, the service pauses until the next day or month; nothing is billed.

**Included:** sign-in (email and password), Firestore database and Security Rules, and Hosting for the app at `https://<project-id>.web.app` (admin notice at `/admin`).

**Not included (needs the paid Blaze plan):** AI features, the working admin console, server feature flags, and progress-photo storage. The app shows a clear message for each of these. Data export and account deletion still work, running on the device.

## One-time setup (about 10 minutes, all in your browser)

### 1. Firebase project (stay on Spark)
1. Open https://console.firebase.google.com and click **Create a project** (or open an existing one).
2. You can turn off Google Analytics. **Don't** click "Upgrade" or add billing anywhere.
3. Note the **project ID** under ⚙️ → Project settings.

### 2. Turn on email sign-in
Build → **Authentication** → **Get started** → **Sign-in method** → **Email/Password** → enable the first switch → **Save**.

### 3. Create the database
Build → **Firestore Database** → **Create database** → pick a location (e.g. `asia-south1` Mumbai) → **Start in production mode** → **Create**. The deploy will put FORMA's Security Rules in place. (The workflow also tries to create the database if you skip this step.)

### 4. Create a deploy key (service account)
1. Open https://console.cloud.google.com/iam-admin/serviceaccounts and select your Firebase project at the top.
2. **Create service account** → name `forma-deployer` → **Create and continue**.
3. Add the roles **Firebase Admin** and **Service Usage Consumer** → **Continue** → **Done**.
4. Click the new account → **Keys** → **Add key** → **Create new key** → **JSON** → **Create**. A file downloads.

Treat this file like a password. It can change your Firebase project, but it can't turn on billing.

### 5. Give the key to GitHub
1. Open https://github.com/Rohit310795/FORMA/settings/secrets/actions
2. **New repository secret** → Name: `FIREBASE_SERVICE_ACCOUNT` → paste the **entire contents** of the JSON file → **Add secret**.
3. Delete the downloaded JSON file from your computer.

Optional repository **variables** (same page, *Variables* tab): `FIREBASE_PROJECT_ID` (otherwise it's read from the key), `FIRESTORE_LOCATION`, `PRIVACY_URL`, `TERMS_URL`.

### 6. Publish
- **Actions** tab → **Deploy (free Spark setup)** → **Run workflow**. After that, every merge to `main` publishes automatically.
- When it's green, open `https://<project-id>.web.app`. The run's summary shows the link.

## What the workflow does
1. Installs dependencies and runs all checks (typecheck, lint, unit tests). It stops if anything fails.
2. Finds or registers the project's **Web app** and reads its public config (no keys to copy by hand).
3. Builds the mobile web app and the admin console with `SERVER_FEATURES=off` and `STORAGE_ENABLED=off`.
4. Deploys **only** `firestore:rules` and `hosting`. Functions and Storage are never deployed, so nothing needs Blaze.

## Free quotas (check current numbers in your console)
Spark includes generous daily and monthly limits for Authentication, Firestore reads/writes/storage, and Hosting storage/transfer. See Firebase console → **Usage and billing** for your project's live usage and the current limits.

## Later: switch to the full version
Upgrade the project to Blaze, follow docs/SETUP.md §2–5 (Secret Manager, functions deploy, owner bootstrap), and rebuild without the `*_SERVER_FEATURES=off` / `STORAGE_ENABLED=off` flags. No code changes are needed.
