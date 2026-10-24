import { createHash, randomBytes } from 'node:crypto';
import { USAGE_HASH_SALT } from './config';

export const newId = (bytes = 12) => randomBytes(bytes).toString('base64url');
export const requestId = () => newId(9);
/** Pseudonymous, stable user identifier for usage analytics. Not reversible without the salt. */
export const userHash = (uid: string) => createHash('sha256').update(`${USAGE_HASH_SALT}:${uid}`).digest('hex').slice(0, 24);
