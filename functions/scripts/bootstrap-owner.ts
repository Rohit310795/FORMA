/**
 * Secure owner bootstrap — run ONCE from your own machine, never from the app.
 *
 *   1. Sign up in the FORMA app or admin console with the owner's email (normal sign-up).
 *   2. Download a service-account key for the Firebase project (keep it private, never commit it).
 *   3. Run:
 *        GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *          npm run bootstrap-owner -w functions -- --email you@example.com --project your-project-id
 *
 * It sets the `role: "owner"` custom claim (a server-only, tamper-proof flag),
 * records an audit entry, and refuses if an owner already exists unless
 * --allow-additional is passed. There is no default password and no public
 * admin sign-up. Against the emulator, set FIREBASE_AUTH_EMULATOR_HOST and
 * FIRESTORE_EMULATOR_HOST instead of credentials.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = arg('email');
const projectId = arg('project') ?? process.env.GCLOUD_PROJECT;
const allowAdditional = args.includes('--allow-additional');

if (!email || !projectId) {
  console.error('Usage: bootstrap-owner --email <owner email> --project <firebase project id> [--allow-additional]');
  process.exit(1);
}

const usingEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
initializeApp(usingEmulator ? { projectId } : { projectId, credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

const existing = await db.collection('adminRoles').where('role', '==', 'owner').get();
if (!existing.empty && !allowAdditional) {
  console.error('An owner already exists. Use the admin console (Admins) to add people, or pass --allow-additional.');
  process.exit(2);
}

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(`No account found for ${email}. Sign up in the app or admin console first, then re-run.`);
  process.exit(3);
}
if (!user.emailVerified && !usingEmulator) {
  console.warn('Warning: this email address is not verified yet. Verify it before relying on this account.');
}

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: 'owner' });
await auth.revokeRefreshTokens(user.uid);
await db.doc(`adminRoles/${user.uid}`).set({ role: 'owner', email, grantedBy: 'bootstrap-script', grantedAt: new Date().toISOString() });
await db.collection('adminAuditLogs').add({
  at: new Date().toISOString(),
  actorUid: 'bootstrap-script',
  action: 'admins.bootstrapOwner',
  target: `user:${user.uid}`,
  outcome: 'success',
  summary: 'initial owner role granted via bootstrap script',
});
console.log(`✔ ${email} is now the FORMA owner. Sign out and back in to the admin console to load the new role.`);
process.exit(0);
