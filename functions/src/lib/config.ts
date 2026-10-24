/** Server configuration. Secrets never live here — only non-secret settings. */
export const REGION = process.env.FUNCTIONS_REGION || 'asia-south1';
export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true';
export const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
/** Public Firebase Web API key (not a secret) — used to send password-reset emails via Identity Toolkit. */
export const FIREBASE_WEB_API_KEY = process.env.FORMA_WEB_API_KEY || '';
/** Require MFA (second factor) on admin tokens. Recommended in production. */
export const ADMIN_REQUIRE_MFA = process.env.FORMA_ADMIN_REQUIRE_MFA === 'true';
/** Require App Check on callable functions (enable once apps are registered). */
export const ENFORCE_APP_CHECK = process.env.FORMA_ENFORCE_APP_CHECK === 'true';
/** Salt for pseudonymous user hashes in analytics/usage. Set per environment. */
export const USAGE_HASH_SALT = process.env.FORMA_USAGE_HASH_SALT || 'dev-only-salt';
export const USAGE_RETENTION_DAYS = Number(process.env.FORMA_USAGE_RETENTION_DAYS || 90);
