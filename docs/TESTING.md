# Testing

| Command | What it runs | Needs |
|---|---|---|
| `npm run check` | Typecheck all workspaces, ESLint (mobile + admin), unit tests (Vitest) | Node |
| `npm run test:rules` | Firestore & Storage Security Rules tests | Java 21 (emulators auto-download) |
| `npm run test:integration` | Backend integration tests: callables via `.run()` with real emulator ID tokens | Java 21 |
| `npm run test:e2e:mobile` | Playwright drives the mobile **web build** against Auth/Firestore/Functions/Storage emulators | Running emulators + `npm run serve:mobile:web` |
| `npm run test:e2e:admin` | Playwright drives the admin console against the emulators | Running emulators, an owner account (below) + `npm run serve:admin` |

### Running the E2E suites

```bash
npm run build:functions
npx firebase emulators:start --only auth,firestore,functions,storage --project demo-forma   # terminal 1
EXPO_PUBLIC_USE_EMULATORS=true npm run build:mobile:web && npm run serve:mobile:web        # terminal 2
NEXT_PUBLIC_USE_EMULATORS=true npm run build:admin && npm run serve:admin                  # terminal 3
# one-time owner for the admin suite:
curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake" \
  -H 'content-type: application/json' -d '{"email":"owner@forma.test","password":"OwnerPass!123"}'
(cd functions && FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  npm run bootstrap-owner -- --email owner@forma.test --project demo-forma)
npm run test:e2e:mobile && npm run test:e2e:admin
```

Screenshots are written to `test-results/`.

## Coverage map (what's proven)

- **Auth & security:** registration and login, persistent session across reloads, password reset (client flow), user isolation (rules), non-admins refused, Firestore-written roles ignored, least-privilege roles, revoked tokens rejected, unknown admin actions rejected, secrets never returned or logged, audit trail.
- **Fitness:** plan building from templates (equipment, volume caps, safety filter), plan versioning, live logging (sets, rest timer), session completion and summary, PRs/volume/consistency maths, offline outbox (persistence, coalescing, retry, no false “synced”, items queued mid-flush).
- **Recovery & safety:** discomfort triage levels and red flags, clinician-instruction precedence, region pausing, AI red-flag screening (no model call), unsafe output replaced, safety can't be bypassed by prompt edits or a weaker policy in the database, health-consent gate.
- **AI & admin:** provider config, invalid credential refused, timeout → fallback, auth error not retried, disabled providers/keys skipped, capability check for structured output, attempt cap, cancellation, kill switch, rate limits, plan quotas, budgets (global/provider), prompt versioning and rollback, usage/cost roll-ups, entitlement overrides.
- **Privacy:** data export (own data only), account deletion (recent-login requirement, data + auth removed), admin two-step deletion, private photo access (Storage rules), AI context minimisation.

## Not covered automatically
- HealthKit and native modules (Apple sign-in, notifications, image picker) on real devices — needs Apple hardware and signed builds.
- Real provider calls (OpenAI/Gemini/Anthropic) — adapters are tested against their documented request/response shapes with mocked HTTP. Verify with a real key using “Test connectivity” in the console.
- Google/Apple OAuth flows (need configured client IDs).
