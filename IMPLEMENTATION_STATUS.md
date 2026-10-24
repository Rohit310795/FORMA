# FORMA — implementation status

_Last updated: 2026-10-24._

## Deployment mode: free (Spark)
The published build runs on Firebase's **free Spark plan** (docs/DEPLOY_FREE.md). It deploys only Firestore rules and Hosting (app at `/`, admin notice at `/admin`) through `.github/workflows/deploy.yml`. In this mode AI features, the admin console, server feature flags and photo storage are off. Data export and account deletion run on the device (verified by a free-mode E2E run with no Cloud Functions: 15/15 steps). Everything else in this document describes the full (Blaze) version, which needs no code changes to enable.

## Summary
The mobile app, the admin console and the trusted backend are implemented and verified end-to-end against the Firebase Emulator Suite. What remains is mostly **external setup** (a real Firebase project, AI provider keys, Apple/Google developer configuration, device builds) plus a short list of follow-ups below.

## Test results (all executed in this environment)

| Suite | Result |
|---|---|
| Typecheck (shared, functions, mobile, admin) | ✅ clean |
| ESLint (mobile with React Compiler rules, admin with Next rules) | ✅ clean |
| Unit tests — `npm test` | ✅ **99 passed** (shared 66 · functions 28 · mobile 5) |
| Security Rules — `npm run test:rules` (Firestore + Storage emulators) | ✅ **24 passed** |
| Backend integration — `npm run test:integration` (Auth + Firestore emulators) | ✅ **22 passed** |
| Mobile E2E — Playwright on the web build vs. Auth/Firestore/Functions/Storage emulators | ✅ **16 / 16 steps** |
| Admin E2E — Playwright on the static console vs. emulators | ✅ **10 / 10 steps** |
| Free-mode mobile E2E — combined Hosting build vs. Auth + Firestore only (no Functions) | ✅ **15 / 15 steps** |
| Builds: functions bundle, admin static export, mobile web export | ✅ |

Not executed (need external resources): HealthKit and other native modules on a real iPhone, real AI provider calls, Google/Apple OAuth, deployment to a real Firebase project.

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | App launches with a polished, coherent FORMA design | ✅ Dark-first design system from shared tokens, light mode, verified in E2E screenshots |
| 2 | Register, log in, persistent accounts | ✅ Email/password (E2E); Apple/Google implemented, need provider config |
| 3 | Fitness profile and goals | ✅ Onboarding (skippable, consent-first), profile editing, goals with milestones |
| 4 | Build plans, log workouts, view progress | ✅ Templates, AI drafts, versioned editor, live logging, PRs, volume, consistency |
| 5 | Recovery, Knee Health, joint education | ✅ Six-tab Recovery module, deterministic knee triage, knee library, joint pages, clinician instructions |
| 6 | Nutrition, hydration, sleep, supplements, wellness flows | ✅ All functional with real persistence |
| 7 | AI uses a server-side gateway | ✅ `functions/src/ai` |
| 8 | OpenAI, Gemini and future providers without rewriting features | ✅ Adapters: OpenAI, Gemini, Anthropic, OpenAI-compatible |
| 9 | Credentials never exposed | ✅ Secret Manager; verified by integration and E2E tests |
| 10 | Admin manages providers, routing, fallbacks | ✅ |
| 11 | Admin controls flags and entitlements | ✅ Server-enforced |
| 12 | Usage, costs, budgets, errors visible | ✅ Roll-ups, budgets, alerts; costs labelled as estimates |
| 13 | Admin actions authorised and audited | ✅ |
| 14 | Rules and backend authorisation prevent unauthorised access | ✅ Rules and integration tests |
| 15 | HealthKit where native setup supports it | 🟡 Implemented with setup guide; **not yet run on a device** |
| 16 | Handles provider failures, empty/loading/offline states | ✅ Fallbacks, safe messages, offline outbox |
| 17 | Critical tests executed | ✅ See above |
| 18 | Setup, deployment, env and troubleshooting docs | ✅ `docs/`, `.env.example` files |

## Phases

1. **Foundation** ✅ Monorepo, design tokens, components, routing, auth, Firebase config, protected admin structure.
2. **Core fitness** ✅ Onboarding, Home, My Body, muscle map, exercise library (~70 exercises), plans, live logging, progress.
3. **Wellness & recovery** ✅ Nutrition (Indian and international starter foods, BMR/TDEE explainer), hydration, sleep, mobility (13 routines), recovery, knee health, supplements (cited evidence summaries), Glow.
4. **AI platform** ✅ Gateway, adapters, routing, context minimisation, rate limits, quotas, fallbacks, safety, usage and cost tracking.
5. **Admin console** ✅ Owner bootstrap, providers and keys, routing, flags, users, entitlements and plans, usage and budgets, prompts (versioning, preview, rollback), settings, audit log, admins.
6. **Apple Health** 🟡 Code, consent, de-duplication and revocation flow are done; device testing is pending.
7. **Hardening** 🟡 Rules reviewed and tested, CI workflow, security headers, lint with React Compiler rules. Pending items below.

## Pending / follow-ups (honest list)

- **App Check client SDK** isn't initialised in the apps yet. Keep `FORMA_ENFORCE_APP_CHECK=false` until it's added.
- **Product analytics events** (onboarding completed, workout started…) aren't sent to an analytics service yet. The consent flag exists, and server logs plus AI usage events are in place.
- **Error monitoring** (Crashlytics/Sentry) isn't configured.
- **Admin MFA enrolment UI:** enforcement exists (`FORMA_ADMIN_REQUIRE_MFA`), but enrolment must be done through Firebase's supported flows.
- **Streaming AI responses** are intentionally off: responses are validated before display.
- **Payments** aren't integrated. Plans run in clearly labelled test mode.
- **Licensed exercise media/photography** isn't included. The app uses text instructions, icons and gradients; no unlicensed URLs.
- **Food data:** a labelled approximate starter database plus manual entry. No external food API (e.g. USDA/Edamam) is connected.
- **Push notifications:** local reminders only (no server push).
- **Android Health Connect:** not supported yet.
- **Data export** returns JSON with photo storage paths; photo files aren't bundled.
- **Muscle priorities** influence template plan building; the AI draft doesn't use them yet.

## External setup you need to complete

1. Create a Firebase project on the Blaze plan; enable Email/Password auth, Firestore, Storage and the Secret Manager API; grant the functions service account **Secret Manager Admin** (docs/SETUP.md §2).
2. Fill `apps/mobile/.env`, `apps/admin/.env.local` and `functions/.env` from the `.env.example` files.
3. Deploy rules, indexes, functions and hosting (docs/SETUP.md §3).
4. Create the owner with the bootstrap script (docs/SETUP.md §4).
5. Add AI provider keys and routes in the console (docs/SETUP.md §5). You need your own OpenAI / Google AI / other provider accounts.
6. For iOS: an Apple Developer account, your bundle id, HealthKit and Sign in with Apple capabilities, then an EAS development build on a physical iPhone (docs/HEALTHKIT.md).
7. Optional: Google OAuth client IDs; privacy policy and terms URLs; App Check; MFA for admins; backups (docs/SETUP.md §7).
