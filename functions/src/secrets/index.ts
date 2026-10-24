import { IS_EMULATOR, PROJECT_ID } from '../lib/config';
import { db } from '../lib/firebase';
import { CachedSecretStore, type SecretStore } from './secretStore';
import { EmulatorSecretStore } from './emulatorSecretStore';
import { GoogleSecretManagerStore } from './googleSecretManager';

let store: SecretStore | undefined;

/** Secret Manager in deployed environments; a clearly-labelled dev store in the emulator. */
export function secretStore(): SecretStore {
  if (!store) store = new CachedSecretStore(IS_EMULATOR ? new EmulatorSecretStore(db) : new GoogleSecretManagerStore(PROJECT_ID));
  return store;
}
