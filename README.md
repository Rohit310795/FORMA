# FORMA

**FORMA** is a premium, AI-assisted fitness and wellness app: training plans and live workout logging, nutrition, sleep, hydration, recovery and joint health (including knee health), mobility, skincare and supplements, plus an AI coach. An owner-only admin console controls AI providers, model routing, feature flags, users, plans, budgets, prompts and settings, all without code changes.

> FORMA provides fitness and wellness education. It doesn't diagnose or treat medical conditions.

| | |
|---|---|
| `apps/mobile` | Expo (React Native) app: iOS, Android, web |
| `apps/admin` | Next.js admin console (static, Firebase Hosting) |
| `functions` | Cloud Functions: AI gateway, admin API, privacy workflows |
| `packages/shared` | Shared types, schemas, design tokens, calculations, safety engine, content |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) · [Data model](docs/DATA_MODEL.md) · [Security](docs/SECURITY.md) · [Setup & deploy](docs/SETUP.md) · [HealthKit](docs/HEALTHKIT.md) · [Testing](docs/TESTING.md) |

Status, test results and open items: **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)**.

## Quick start (local, no cloud account)

Requires Node 22 and Java 21.

```bash
npm install
npm run build:functions
npx firebase emulators:start --only auth,firestore,functions,storage --project demo-forma
# new terminal
cd apps/mobile && npx expo start          # press "w" for web
# new terminal
cd apps/admin && npm run dev              # http://localhost:3000/admin
```

Make yourself an admin locally: see [docs/SETUP.md §1](docs/SETUP.md#1-run-everything-locally-no-cloud-account-needed).

## Commands

| Command | Purpose |
|---|---|
| `npm run check` | Typecheck + lint + unit tests (run before committing) |
| `npm run test:rules` | Security Rules tests (emulators) |
| `npm run test:integration` | Backend integration tests (emulators) |
| `npm run test:e2e:mobile` / `test:e2e:admin` | Browser E2E suites (see docs/TESTING.md) |
| `npm run build:functions` | Bundle Cloud Functions |
| `npm run build:admin` | Static export of the admin console |
| `npm run build:mobile:web` | Web bundle of the mobile app |

## Publish for free

Follow **[docs/DEPLOY_FREE.md](docs/DEPLOY_FREE.md)**. FORMA runs on Firebase's free Spark plan, published by GitHub Actions. AI and the admin console are off in that setup.

## Deploy (full version, Blaze)

See [docs/SETUP.md](docs/SETUP.md). In short: create a Firebase project (Blaze plan), enable Auth/Firestore/Storage/Secret Manager, fill the `.env` files from the `.env.example` templates, then

```bash
npm run build:mobile:web && npm run build:admin && npm run build:hosting
npx firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting --project <your-project>
```

Then create the owner with `functions/scripts/bootstrap-owner.mts` and add AI providers in the console.
