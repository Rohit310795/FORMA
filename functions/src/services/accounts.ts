import { db, auth, storage } from '../lib/firebase';
import { userHash } from '../lib/ids';
import { logger } from '../lib/logger';
import { audit } from './audit';

/** Collects everything stored for a user, for "download my data". */
export async function exportUserData(uid: string) {
  const root = db.doc(`users/${uid}`);
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: (await root.get()).data() ?? null };
  for (const col of await root.listCollections()) {
    const docs = await col.get();
    out[col.id] = await Promise.all(
      docs.docs.map(async (d) => {
        const entry: Record<string, unknown> = { id: d.id, ...d.data() };
        // Conversations keep their messages in a subcollection.
        if (col.id === 'aiConversations') entry.messages = (await d.ref.collection('messages').orderBy('createdAt').get()).docs.map((m) => ({ id: m.id, ...m.data() }));
        return entry;
      }),
    );
  }
  out.entitlement = (await db.doc(`userEntitlements/${uid}`).get()).data() ?? null;
  out.note = 'Progress photos are listed by storage path; download them from the app while signed in.';
  return out;
}

/** Permanently deletes a user's data, files and auth account. */
export async function deleteUserCompletely(uid: string, actor: { uid: string; role?: string; requestId: string }) {
  await db.doc(`users/${uid}`).set({ status: 'deletion_pending' }, { merge: true });
  await db.recursiveDelete(db.doc(`users/${uid}`));
  await db.doc(`userEntitlements/${uid}`).delete().catch(() => undefined);
  try {
    await storage().bucket().deleteFiles({ prefix: `users/${uid}/` });
  } catch (err) {
    logger.warn('storage_delete_failed', { requestId: actor.requestId, message: (err as Error).message });
  }
  await auth.deleteUser(uid).catch((err) => {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  });
  await db.doc(`deletionRequests/${uid}`).delete().catch(() => undefined);
  await audit({
    actorUid: actor.uid === uid ? 'self' : actor.uid,
    actorRole: actor.role,
    action: 'account.deleted',
    target: `user:${userHash(uid)}`,
    outcome: 'success',
    requestId: actor.requestId,
  });
}
