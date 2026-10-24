# Firestore data model

User-owned data lives under `users/{uid}` so Security Rules can enforce ownership by path. Server-only data lives in top-level collections that clients can't read or write at all. Schemas are the Zod definitions in `packages/shared/src/schemas`.

## User data (owner read/write unless noted)

| Path | Purpose | Notes |
|---|---|---|
| `users/{uid}` | Account root: `status`, `createdAt`, `lastActiveAt` | **Server-managed.** Read-only for the user. |
| `users/{uid}/profile/main` | Profile, goals, preferences, consent (`userProfiles`, `userGoals` summary) | Rules allow only known fields. |
| `users/{uid}/goals/{id}` | Goal records with milestones (`userGoals`) | |
| `users/{uid}/bodyMeasurements/{id}` | Weight, circumferences, optional body-fat and method | `dayKey` = user's local date |
| `users/{uid}/progressPhotos/{id}` | Photo metadata; files in Storage `users/{uid}/progressPhotos/` | Private: owner only (Storage rules) |
| `users/{uid}/workoutPlans/{id}` | Versioned plans (`version`, `revision`) | |
| `users/{uid}/workoutSessions/{id}` | Logged sessions (snapshot of exercises/sets) | `externalId` de-duplicates HealthKit imports |
| `users/{uid}/nutritionLogs/{id}` | Food entries (estimates flagged) | |
| `users/{uid}/savedMeals/{id}` | Reusable meals | |
| `users/{uid}/hydrationLogs/{id}` | Water entries | |
| `users/{uid}/sleepLogs/{id}` | Sleep (self-reported or `source: healthkit`) | |
| `users/{uid}/recoveryCheckIns/{id}` | Daily check-ins | |
| `users/{uid}/discomfortLogs/{id}` | Discomfort details | **Requires `consent.healthDetails`** (enforced by rules) |
| `users/{uid}/clinicianInstructions/{id}` | User-entered clinician guidance | **Requires `consent.healthDetails`** |
| `users/{uid}/mobilitySessions/{id}` | Completed mobility routines | |
| `users/{uid}/supplementInventory/{id}` | User's supplements, timing, consistency | |
| `users/{uid}/wellnessRoutines/{id}` | Skincare/habit routines with bounded recent completions | |
| `users/{uid}/settings/healthSync` | HealthKit connection metadata (`healthSyncMetadata`) | |
| `users/{uid}/settings/notifications` | Reminder preferences (`notificationPreferences`) | |
| `users/{uid}/settings/nutritionTargets` | Calorie/macro/water targets | |
| `users/{uid}/settings/musclePriorities` | Priority / maintain / reduce per muscle | |
| `users/{uid}/aiConversations/{id}` (+ `/messages/{id}`) | AI chat history | **Written only by functions**; user can read/delete |

Every record carries `id` (client-generated, equal to the doc id), `createdAt`, `updatedAt`, `revision` and `source`. Rules reject records whose `id` doesn't match or that have more than 60 fields. Arrays are bounded (e.g. `takenDays` ≤ 62).

## Server-only collections (no client access)

| Collection | Purpose |
|---|---|
| `userEntitlements/{uid}` | Plan, status, feature overrides, AI overrides. **The user can read their own; only the server writes.** |
| `featureFlags/{key}` | Enabled, rollout %, plan/platform targeting, message |
| `plans/{id}` | Plan definitions (Free/Pro defaults are built in until edited) |
| `aiProviderMetadata/{id}` | `config` (models, prices, limits) + `status` (credential reference, masked suffix, health). **No secrets.** Sub-collection `healthChecks` (TTL). |
| `aiFeatureRoutes/{routeKey}` | Primary/fallback models, limits, budgets, safety policy, context categories |
| `promptVersions/{id}` + `promptCounters/{routeKey}` | Versioned prompt guidance (draft/published/archived) |
| `aiUsageEvents/{id}` | Per-attempt usage with pseudonymous `userHash` (TTL via `expireAt`) |
| `aiUsageDaily/{YYYY-MM-DD}`, `aiUsageMonthly/{YYYY-MM}` | Roll-ups by outcome, provider, model and route; tokens and estimated cost |
| `counters/{id}` | Rate-limit and quota counters (TTL) |
| `budgetAlerts/{id}` | One alert per scope per day |
| `appConfig/settings`, `appConfig/budgets` | App settings and budget policy |
| `adminAuditLogs/{id}` | Append-only audit trail (redacted) |
| `adminRoles/{uid}` | Admin list mirror. **Not** used for authorisation. |
| `deletionRequests/{uid}` | Pending admin-initiated deletions |
| `_devSecrets/{id}` | **Emulator only.** Never used in deployed environments. |

## Content (versioned in code)

`exerciseLibrary`, `jointExerciseLibrary` and `mobilityRoutines` are shipped in `packages/shared/src/content` instead of Firestore, so they work offline and their safety tags are reviewed with the code that relies on them. The starter food and supplement references are there too.

## Indexes & TTL

`firestore.indexes.json` defines the composite indexes (`promptVersions` by route+version and route+status, `adminAuditLogs` by action+time) and TTL policies on `expireAt` for `aiUsageEvents`, `counters` and `healthChecks`. Deploy them with `firebase deploy --only firestore:indexes`.
