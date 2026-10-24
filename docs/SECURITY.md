# Security & privacy

## Secrets
- AI provider keys are entered in the Admin Console → AI Providers, sent once over HTTPS to `adminApi`, optionally tested, and stored in **Google Secret Manager** (`forma-ai-<providerId>`). Firestore stores only a reference and a masked suffix (`…abcd`). Keys are never returned to any client. Rotating a key disables older versions.
- No secret is ever placed in `EXPO_PUBLIC_*` / `NEXT_PUBLIC_*` variables or committed. `.gitignore` excludes `.env*`, service-account files and Apple signing files.
- Logs and audit summaries pass through `redactSecrets` / `redactObject`. Provider error bodies are never surfaced.

## Admin access
- Roles (`owner`, `admin`, `support`, `analyst`) are **Firebase Auth custom claims**, settable only by trusted server code. A Firestore field can never grant access (covered by integration and rules tests).
- Every `adminApi` call verifies the ID token **with revocation check**, the role claim, optional second factor (`FORMA_ADMIN_REQUIRE_MFA=true`), a 120 requests/min rate limit, and the action's permission. Denials are audited.
- The action list is fixed and every payload is Zod-validated. There are no arbitrary queries or commands.
- Destructive actions need typed confirmation. Admin-initiated deletion is two-step (request → owner executes).
- **First owner:** created with `functions/scripts/bootstrap-owner.mts` (see SETUP.md). It refuses to run if an owner already exists. There is no default password and no public admin sign-up.
- **MFA (recommended):** enable Identity Platform multi-factor authentication for admin accounts in the Firebase console, then set `FORMA_ADMIN_REQUIRE_MFA=true` for the functions. (The console's login form surfaces the MFA requirement; enrolling a second factor is done through Firebase's supported flows.)

## Data protection
- Firestore rules restrict each user to `users/{uid}`, whitelist profile fields, keep account status, entitlements and AI conversations server-written, require health consent for discomfort and clinician data, and deny all server collections. Storage rules make progress photos owner-only (images ≤ 10 MB).
- Admins can't see user logs, photos or conversations. The Users page shows account metadata only.
- AI context is minimised (see ARCHITECTURE.md §5) and never includes photos or names. Usage analytics use a salted user hash.
- Users can export their data (JSON) and delete their account (recent sign-in required). Deletion removes Firestore data, Storage files and the Auth account, and keeps an anonymised audit entry.
- Lock-screen notifications are generic unless the user opts in.

## Health safety (non-bypassable)
- `packages/shared/src/safety` holds deterministic discomfort triage (urgent / prompt assessment / modify) and the exercise filter (clinician instructions → avoid list → paused regions → discomfort tags), plus AI input screening and output checks. These run in server code (and in the app for display) independently of any model or editable prompt.

## App Check & hosting
- The backend supports App Check enforcement (`FORMA_ENFORCE_APP_CHECK=true`), but **the apps don't initialise the App Check client SDK yet**. Keep enforcement off until that's added (App Attest on iOS, Play Integrity on Android, reCAPTCHA Enterprise on web). This is listed as pending in IMPLEMENTATION_STATUS.md.
- Admin hosting sends strict security headers (CSP, frame-ancestors none, HSTS, no-referrer). See `firebase.json`.

## Reporting
Report vulnerabilities privately to the owner. Don't open public issues for security problems.
