import * as Crypto from 'expo-crypto';

/** Client-generated ids make offline writes idempotent: retries hit the same document. */
export const newId = () => Crypto.randomUUID().replace(/-/g, '');
export const nowIso = () => new Date().toISOString();
