import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { profileSchema, type Profile } from '@forma/shared';
import { useMutations, useUserDoc } from './data';
import { nowIso } from './ids';

interface ProfileCtx {
  profile?: Profile;
  loading: boolean;
  /** Merges a patch into the profile and queues it for sync. */
  save(patch: Partial<Profile>): Promise<void>;
}
const Ctx = createContext<ProfileCtx>({ loading: true, save: async () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data, loading } = useUserDoc<Profile>('profile', 'main');
  const { save: saveDoc } = useMutations();
  const profile = useMemo(() => {
    if (!data) return undefined;
    const parsed = profileSchema.safeParse(data);
    return parsed.success ? parsed.data : (data as Profile);
  }, [data]);
  const save = useCallback(
    async (patch: Partial<Profile>) => {
      const next = profileSchema.parse({ displayName: 'You', ...profile, ...patch, updatedAt: nowIso() });
      await saveDoc('profile', 'main', next);
    },
    [profile, saveDoc],
  );
  return <Ctx.Provider value={{ profile, loading, save }}>{children}</Ctx.Provider>;
}

export const useProfile = () => useContext(Ctx);
