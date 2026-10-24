import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { hasPermission, isAdminRole, type AdminRole, type Permission } from '@forma/shared';
import type { ZodType } from 'zod';
import { ADMIN_REQUIRE_MFA, ENFORCE_APP_CHECK, REGION } from './config';
import { PublicError, toPublicError } from './errors';
import { requestId } from './ids';
import { auth } from './firebase';
import { ensureUser, requireActiveUser } from '../services/users';
import { consumeAdminRate } from '../services/limits';
import { audit } from '../services/audit';
import type { Entitlement } from '@forma/shared';
import type { UserRecord } from '../services/users';

export interface UserContext<I> {
  uid: string;
  input: I;
  requestId: string;
  account: { user: UserRecord; entitlement: Entitlement };
  request: CallableRequest;
  signal: AbortSignal;
}

const baseOptions = { region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, memory: '512MiB' as const, timeoutSeconds: 120 };

function abortSignalFor(request: CallableRequest): AbortSignal {
  const ctrl = new AbortController();
  // If the client goes away, stop provider calls instead of paying for them.
  request.rawRequest?.on?.('aborted', () => ctrl.abort());
  return ctrl.signal;
}

/** Authenticated end-user callable: validates input with Zod and rejects suspended accounts. */
export function userCallable<I, O>(schema: ZodType<I>, handler: (ctx: UserContext<I>) => Promise<O>, opts: { allowSuspended?: boolean } = {}) {
  return onCall(baseOptions, async (request) => {
    const rid = requestId();
    try {
      if (!request.auth) throw new PublicError('unauthenticated', 'Please sign in.');
      const input = schema.parse(request.data ?? {});
      // Suspended users keep their privacy rights (export / delete) but nothing else.
      const account = opts.allowSuspended ? await ensureUser(request.auth.uid) : await requireActiveUser(request.auth.uid);
      return await handler({ uid: request.auth.uid, input, requestId: rid, account, request, signal: abortSignalFor(request) });
    } catch (err) {
      throw toPublicError(err, rid);
    }
  });
}

export interface AdminContext {
  uid: string;
  role: AdminRole;
  requestId: string;
  email?: string;
}

/**
 * Verifies an admin request entirely on the server:
 *  - a signed-in user whose ID token is not revoked,
 *  - a `role` custom claim (set only by trusted server code / bootstrap script),
 *  - optional second factor,
 *  - per-admin rate limit,
 *  - the action's permission for that role.
 * Every denial is audited.
 */
export async function verifyAdmin(request: CallableRequest, permission: Permission, rid: string, action: string): Promise<AdminContext> {
  if (!request.auth) throw new PublicError('unauthenticated', 'Please sign in.');
  const uid = request.auth.uid;
  const deny = async (reason: string): Promise<never> => {
    await audit({ actorUid: uid, actorRole: String(request.auth?.token.role ?? 'none'), action, outcome: 'denied', summary: reason, requestId: rid });
    throw new PublicError('permission-denied', 'You do not have access to this action.');
  };
  let token;
  try {
    token = await auth.verifyIdToken(request.auth.rawToken, true);
  } catch {
    return deny('token revoked or invalid');
  }
  const role = token.role;
  if (!isAdminRole(role)) return deny('not an admin');
  if (ADMIN_REQUIRE_MFA && !token.firebase?.sign_in_second_factor) return deny('second factor required');
  if (!(await consumeAdminRate(uid))) throw new PublicError('resource-exhausted', 'Too many admin requests. Please slow down.');
  if (!hasPermission(role, permission)) return deny(`missing permission ${permission}`);
  return { uid, role, requestId: rid, email: token.email };
}

export const callableOptions = baseOptions;
export { onCall };
