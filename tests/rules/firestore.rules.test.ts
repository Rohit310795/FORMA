import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env: RulesTestEnvironment;
const now = '2026-10-24T10:00:00.000Z';
const record = (id: string, extra: Record<string, unknown> = {}) => ({ id, createdAt: now, updatedAt: now, revision: 0, source: 'manual', ...extra });
const profile = (extra: Record<string, unknown> = {}) => ({ displayName: 'Alex', units: 'metric', updatedAt: now, consent: { healthDetails: false, aiContext: [] }, ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-forma',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
});

describe('user data isolation', () => {
  it('a user can write and read their own records', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/workoutSessions/s1'), record('s1', { name: 'Push', status: 'completed' })));
    await assertSucceeds(getDoc(doc(alice, 'users/alice/workoutSessions/s1')));
    await assertSucceeds(getDocs(collection(alice, 'users/alice/hydrationLogs')));
  });

  it('another user cannot read, write or delete them', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/workoutSessions/s1'), record('s1'));
      await setDoc(doc(ctx.firestore(), 'users/alice/profile/main'), profile());
    });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/workoutSessions/s1')));
    await assertFails(getDoc(doc(bob, 'users/alice/profile/main')));
    await assertFails(setDoc(doc(bob, 'users/alice/workoutSessions/s2'), record('s2')));
    await assertFails(deleteDoc(doc(bob, 'users/alice/workoutSessions/s1')));
    await assertFails(getDocs(collection(bob, 'users/alice/workoutSessions')));
  });

  it('signed-out visitors get nothing', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/alice/profile/main')));
    await assertFails(setDoc(doc(anon, 'users/alice/hydrationLogs/h1'), record('h1')));
  });

  it('records must carry their own id and stay small', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'users/alice/hydrationLogs/h1'), record('other')));
    const big: Record<string, unknown> = record('h2');
    for (let i = 0; i < 70; i++) big[`f${i}`] = i;
    await assertFails(setDoc(doc(alice, 'users/alice/hydrationLogs/h2'), big));
    await assertFails(setDoc(doc(alice, 'users/alice/unknownCollection/x'), record('x')));
  });
});

describe('server-managed data', () => {
  it('users cannot change their account status or entitlement', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), { status: 'active', createdAt: now });
      await setDoc(doc(ctx.firestore(), 'userEntitlements/alice'), { planId: 'free', status: 'active' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'users/alice')));
    await assertFails(updateDoc(doc(alice, 'users/alice'), { status: 'active', role: 'owner' }));
    await assertSucceeds(getDoc(doc(alice, 'userEntitlements/alice')));
    await assertFails(setDoc(doc(alice, 'userEntitlements/alice'), { planId: 'pro', status: 'active' }));
    await assertFails(getDoc(doc(env.authenticatedContext('bob').firestore(), 'userEntitlements/alice')));
  });

  it('profile cannot smuggle extra fields such as a role', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/profile/main'), profile()));
    await assertFails(setDoc(doc(alice, 'users/alice/profile/main'), profile({ role: 'owner' })));
    await assertFails(setDoc(doc(alice, 'users/alice/profile/other'), profile()));
  });

  it('AI conversations are read-only for users (written by functions)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/aiConversations/c1'), { title: 'x' });
      await setDoc(doc(ctx.firestore(), 'users/alice/aiConversations/c1/messages/m1'), { role: 'assistant', content: 'hi' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'users/alice/aiConversations/c1/messages/m1')));
    await assertFails(setDoc(doc(alice, 'users/alice/aiConversations/c1/messages/m2'), { role: 'assistant', content: 'forged' }));
    await assertFails(updateDoc(doc(alice, 'users/alice/aiConversations/c1/messages/m1'), { content: 'edited' }));
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice/aiConversations/c1/messages/m1')));
  });

  it.each([
    'featureFlags/aiCoach', 'aiProviderMetadata/openai', 'aiFeatureRoutes/coachChat', 'promptVersions/p1', 'adminAuditLogs/a1',
    'aiUsageEvents/e1', 'aiUsageDaily/2026-10-24', 'plans/pro', 'appConfig/settings', 'adminRoles/alice', '_devSecrets/openai', 'counters/x', 'deletionRequests/alice',
  ])('%s is closed to clients, even ones claiming an admin role', async (path) => {
    for (const ctx of [env.authenticatedContext('alice'), env.authenticatedContext('admin', { role: 'owner' })]) {
      await assertFails(getDoc(doc(ctx.firestore(), path)));
      await assertFails(setDoc(doc(ctx.firestore(), path), { enabled: true }));
    }
  });
});

describe('self-service deletion (free setup)', () => {
  it('owners can delete their profile and settings; others cannot', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await setDoc(doc(alice, 'users/alice/profile/main'), profile());
    await setDoc(doc(alice, 'users/alice/settings/nutritionTargets'), { kcal: 2000 });
    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(deleteDoc(doc(bob, 'users/alice/profile/main')));
    await assertFails(deleteDoc(doc(bob, 'users/alice/settings/nutritionTargets')));
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice/settings/nutritionTargets')));
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice/profile/main')));
  });
});

describe('health-detail consent', () => {
  it('discomfort logs and clinician instructions need explicit consent', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await setDoc(doc(alice, 'users/alice/profile/main'), profile());
    await assertFails(setDoc(doc(alice, 'users/alice/discomfortLogs/d1'), record('d1', { joint: 'knee', severity: 3 })));
    await assertFails(setDoc(doc(alice, 'users/alice/clinicianInstructions/c1'), record('c1', { instructions: 'x' })));
    await setDoc(doc(alice, 'users/alice/profile/main'), profile({ consent: { healthDetails: true, aiContext: [] } }));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/discomfortLogs/d1'), record('d1', { joint: 'knee', severity: 3 })));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/clinicianInstructions/c1'), record('c1', { instructions: 'x' })));
  });
});

describe('private progress photos (Storage)', () => {
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  it('only the owner can upload, read and delete', async () => {
    const alice = env.authenticatedContext('alice').storage();
    const bob = env.authenticatedContext('bob').storage();
    const path = 'users/alice/progressPhotos/p1.jpg';
    await assertSucceeds(uploadBytes(ref(alice, path), img, { contentType: 'image/jpeg' }));
    await assertSucceeds(getBytes(ref(alice, path)));
    await assertFails(getBytes(ref(bob, path)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
    await assertFails(uploadBytes(ref(bob, 'users/alice/progressPhotos/p2.jpg'), img, { contentType: 'image/jpeg' }));
    await assertFails(deleteObject(ref(bob, path)));
    await assertSucceeds(deleteObject(ref(alice, path)));
  });
  it('rejects non-images and other paths', async () => {
    const alice = env.authenticatedContext('alice').storage();
    await assertFails(uploadBytes(ref(alice, 'users/alice/progressPhotos/x.txt'), img, { contentType: 'text/plain' }));
    await assertFails(uploadBytes(ref(alice, 'public/x.jpg'), img, { contentType: 'image/jpeg' }));
  });
});
