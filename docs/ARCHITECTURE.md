# FORMA architecture

```
┌──────────────────────┐      ┌──────────────────────┐
│  Mobile app (Expo)   │      │  Admin console (Next)│
│  iOS · Android · web │      │  static SPA          │
└─────────┬────────────┘      └──────────┬───────────┘
          │ Firebase Auth (ID token)     │
          │ Firestore (own data only,    │ adminApi only
          │   enforced by Security Rules)│ (role checked server-side)
          ▼                              ▼
┌─────────────────────────────────────────────────────┐
│ Cloud Functions (the only trusted backend)          │
│  getMyConfig · aiChat · aiGenerateWorkout ·         │
│  aiFeedback · exportMyData · deleteMyAccount ·      │
│  adminApi (fixed list of audited actions)           │
│                                                     │
│  AI gateway ─► adapters: OpenAI · Gemini ·          │
│               Anthropic · OpenAI-compatible         │
│  Safety engine (code) · budgets · rate limits ·     │
│  usage roll-ups · audit log                         │
└───────┬──────────────────────┬──────────────────────┘
        │                      │
   Firestore              Google Secret Manager
   (config, usage,        (AI provider keys — never
    audit, user data)      in Firestore or clients)
```

## Monorepo

| Path | What it is |
|---|---|
| `packages/shared` | TypeScript shared by everything: design tokens, Zod schemas, feature registry, roles, calculations (energy, training, recovery, progress), the deterministic **safety engine**, offline-sync rules, and content (exercises, joint education, mobility, foods, supplements, split templates). |
| `functions` | Cloud Functions. Bundled with esbuild (including `packages/shared`) into `functions/lib/index.js`. |
| `apps/mobile` | Expo SDK 58 + Expo Router app. Runs on iOS/Android (dev/production builds) and on the web (used for E2E tests). |
| `apps/admin` | Next.js 16 admin console, exported as static files and hosted on Firebase Hosting. |
| `tests/` | Firestore/Storage rules tests, backend integration tests and Playwright E2E scripts. |

## Key decisions

1. **One trusted backend.** Every privileged operation (AI, admin, entitlements, deletion) runs in Cloud Functions. Apps never hold secrets. The admin console is static and calls `adminApi`.
2. **Admin roles are Firebase Auth custom claims** set only by server code (the bootstrap script or the owner via `admins.setRole`). A Firestore document can never grant admin access; `adminRoles/{uid}` exists only to list admins. Every admin call re-verifies the ID token (with revocation check), the role, optional MFA, a rate limit and the action's permission, and is audited.
3. **AI is provider-independent.** Features call `handleAiRequest(routeKey, …)`. The admin chooses a primary model and ordered fallbacks per route. Adapters implement one interface (`generate`, `healthCheck`). Adding a provider means adding an adapter; feature code doesn't change. Adapters use the providers' documented REST APIs (OpenAI Chat Completions, Gemini `generateContent`, Anthropic Messages).
4. **Safety lives in code, not prompts.** Order inside `handleAiRequest`: feature flag/kill switch → deterministic red-flag screening (emergencies, self-harm, joint red flags, disordered-eating signals answered without any model) → per-user rate limit → plan quota → budgets → minimal context → mandatory rules + editable prompt → gateway → structured-output validation → output safety check (diagnosis, cure claims, “push through pain”, very low calories, prescription drugs, unsafe supplement doses, spot reduction, overriding clinicians) → safe fallback. Each route has a minimum safety policy that the database can't lower.
5. **Context minimisation.** The context sent to a model is the intersection of the route's allow-list, the admin's route config, the user's stored consent and the per-message choice. It contains summaries, never raw logs or names. Discomfort details also need separate health consent.
6. **Streaming is intentionally off for user-facing AI.** Answers must pass the output safety check before anyone sees them, so the server buffers each response, validates it, then returns it.
7. **Offline-first writes.** The app writes through a persistent outbox (AsyncStorage). Client-generated ids make retries idempotent, edits to the same record are coalesced, and workouts/plans resolve conflicts by revision (a finished workout is never replaced by an older in-progress copy). Nothing shows as “Synced” until Firestore confirms.
8. **Plans are versioned; sessions are snapshots.** A session copies the exercises it was started with, so editing a plan never rewrites history.
9. **Feature flags are evaluated by the server** (`evaluateFeature`: global kill switch → per-user override → plan/platform targeting → staged rollout bucket → plan entitlement). The app only hides what the server says is off; the server re-checks on every AI request.
10. **Content ships with the app.** The exercise, joint, mobility, food and supplement libraries live in `packages/shared`. They work offline, carry safety tags the filter depends on, and are reviewed in code. No unlicensed media URLs are included.

## Request flow: AI Coach message

1. The app calls `aiChat({ message, shareContext })` with the user's ID token.
2. `userCallable` validates input (Zod) and rejects suspended accounts.
3. `handleAiRequest` runs the pipeline above. Usage events (pseudonymous user hash) and daily/monthly roll-ups are written per attempt.
4. Messages are stored in `users/{uid}/aiConversations/{id}/messages`. Clients can read and delete them but never write them.
