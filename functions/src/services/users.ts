import { evaluateAll, evaluateFeature, entitlementSchema, type Entitlement, type FeatureKey, type Plan } from '@forma/shared';
import { db, FieldValue } from '../lib/firebase';
import { PublicError } from '../lib/errors';
import { loadAppSettings, loadFlags, loadPlan } from './store';

export interface UserRecord {
  status: 'active' | 'suspended' | 'deletion_pending';
  createdAt: string;
  lastActiveAt?: string;
}

/** Creates the server-managed user root + default entitlement on first contact. */
export async function ensureUser(uid: string): Promise<{ user: UserRecord; entitlement: Entitlement }> {
  const userRef = db.doc(`users/${uid}`);
  const entRef = db.doc(`userEntitlements/${uid}`);
  const [u, e] = await Promise.all([userRef.get(), entRef.get()]);
  const now = new Date().toISOString();
  let user = u.data() as UserRecord | undefined;
  if (!user) {
    user = { status: 'active', createdAt: now, lastActiveAt: now };
    await userRef.set(user, { merge: true });
  }
  let entitlement: Entitlement;
  const parsed = entitlementSchema.safeParse(e.data());
  if (parsed.success) entitlement = parsed.data;
  else {
    const settings = await loadAppSettings();
    entitlement = { planId: settings.defaultPlanId, status: 'active', source: 'default', featureOverrides: {}, updatedAt: now };
    await entRef.set(entitlement);
  }
  return { user, entitlement };
}

/** Rejects suspended / pending-deletion accounts for every user callable. */
export async function requireActiveUser(uid: string) {
  const res = await ensureUser(uid);
  if (res.user.status === 'suspended') throw new PublicError('permission-denied', 'This account is suspended. Please contact support.');
  if (res.user.status === 'deletion_pending') throw new PublicError('failed-precondition', 'This account is scheduled for deletion.');
  return res;
}

/** Throttled last-active update (at most hourly) for active-user metrics. */
export async function touchActivity(uid: string, user: UserRecord) {
  const last = user.lastActiveAt ? Date.parse(user.lastActiveAt) : 0;
  if (Date.now() - last > 3_600_000) await db.doc(`users/${uid}`).set({ lastActiveAt: new Date().toISOString() }, { merge: true });
}

export async function effectivePlan(entitlement: Entitlement): Promise<Plan | undefined> {
  return loadPlan(entitlement.planId);
}

export async function featureFor(uid: string, key: FeatureKey, platform?: 'ios' | 'android' | 'web') {
  const { entitlement } = await ensureUser(uid);
  const [flags, plan] = await Promise.all([loadFlags(), effectivePlan(entitlement)]);
  return evaluateFeature(key, { uid, platform, flags, entitlement, plan });
}

export async function featuresFor(uid: string, entitlement: Entitlement, platform?: 'ios' | 'android' | 'web') {
  const [flags, plan] = await Promise.all([loadFlags(), effectivePlan(entitlement)]);
  return { decisions: evaluateAll({ uid, platform, flags, entitlement, plan }), plan };
}

export const increment = FieldValue.increment;
