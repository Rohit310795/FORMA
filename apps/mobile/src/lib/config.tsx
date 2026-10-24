import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURES, type FeatureKey } from '@forma/shared';
import { api, type MyConfig } from './api';
import { useAuth } from './auth';

interface ConfigCtx {
  config?: MyConfig;
  /** True when we're showing a cached copy because the server couldn't be reached. */
  stale: boolean;
  refresh(): Promise<void>;
}
const Ctx = createContext<ConfigCtx>({ stale: false, refresh: async () => {} });

/**
 * Loads server-evaluated features, plan and settings. The server enforces
 * everything; this is only for presentation (hiding switched-off features).
 */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = user ? `forma:config:${user.uid}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; config: MyConfig }>();
  const [stale, setStale] = useState(false);
  // Only expose config that belongs to the signed-in account.
  const config = loaded && loaded.key === key ? loaded.config : undefined;

  const load = useCallback(
    (k: string) =>
      fetchConfig(k).then(
        (c) => {
          setLoaded({ key: k, config: c });
          setStale(false);
        },
        () => setStale(true),
      ),
    [],
  );
  const refresh = useCallback(async () => {
    if (key) await load(key);
  }, [key, load]);

  useEffect(() => {
    if (!key) return;
    void AsyncStorage.getItem(key).then((raw) => raw && setLoaded((l) => (l?.key === key ? l : { key, config: JSON.parse(raw) })));
    void load(key);
    let last = Date.now();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - last > 5 * 60_000) {
        last = Date.now();
        void load(key);
      }
    });
    return () => sub.remove();
  }, [key, load]);

  return <Ctx.Provider value={{ config, stale, refresh }}>{children}</Ctx.Provider>;
}

/** Fetches server-evaluated config and caches it on the device for offline starts. */
async function fetchConfig(key: string): Promise<MyConfig> {
  const c = await api.getMyConfig({ platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web' });
  await AsyncStorage.setItem(key, JSON.stringify(c)).catch(() => undefined);
  return c;
}

export const useConfig = () => useContext(Ctx);

export function useFeature(key: FeatureKey) {
  const { config } = useConfig();
  const d = config?.features?.[key];
  // Before the first response, assume the registry default; the server re-checks every request.
  return { enabled: d ? d.enabled : FEATURES[key].defaultEnabled, message: d?.message ?? FEATURES[key].disabledMessage };
}
