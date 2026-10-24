'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { hasPermission, type AdminRole, type Permission } from '@forma/shared';
import { auth, adminCall } from './firebase';

interface Session {
  user: User | null;
  role?: AdminRole;
  state: 'loading' | 'signed_out' | 'denied' | 'ready';
  can(p: Permission): boolean;
  logout(): Promise<void>;
}
const Ctx = createContext<Session>({ user: null, state: 'loading', can: () => false, logout: async () => {} });

/**
 * The role shown here comes from the server (`session.whoami`), which verifies the
 * custom claim and token revocation. It only drives navigation; every action is
 * authorised again by the backend.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole>();
  const [state, setState] = useState<Session['state']>('loading');
  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setRole(undefined);
        if (!u) return setState('signed_out');
        setState('loading');
        try {
          await u.getIdToken(true);
          const who = await adminCall<{ role: AdminRole }>('session.whoami');
          setRole(who.role);
          setState('ready');
        } catch {
          setState('denied');
        }
      }),
    [],
  );
  return (
    <Ctx.Provider value={{ user, role, state, can: (p) => hasPermission(role, p), logout: () => signOut(auth) }}>{children}</Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
