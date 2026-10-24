import type { Firestore } from 'firebase-admin/firestore';
import type { SecretStore } from './secretStore';

/**
 * DEVELOPMENT ONLY. Used exclusively when running in the Firebase Emulator
 * Suite so the admin console can be exercised locally without a GCP project.
 * The `_devSecrets` collection is denied to all clients by security rules,
 * and this class refuses to construct outside the emulator.
 */
export class EmulatorSecretStore implements SecretStore {
  constructor(private db: Firestore) {
    if (process.env.FUNCTIONS_EMULATOR !== 'true') throw new Error('EmulatorSecretStore is only available in the emulator');
  }
  async put(id: string, value: string) {
    await this.db.doc(`_devSecrets/${id}`).set({ value, enabled: true });
    return { ref: `emulator://_devSecrets/${id}` };
  }
  async get(id: string) {
    const snap = await this.db.doc(`_devSecrets/${id}`).get();
    const d = snap.data();
    return d?.enabled ? (d.value as string) : undefined;
  }
  async disable(id: string) {
    await this.db.doc(`_devSecrets/${id}`).set({ enabled: false }, { merge: true });
  }
  async remove(id: string) {
    await this.db.doc(`_devSecrets/${id}`).delete();
  }
}
