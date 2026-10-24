import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { themes, spacing, radius, fontSize, type ThemeColors } from '@forma/shared';

export type ThemePreference = 'system' | 'dark' | 'light';
interface Theme {
  scheme: 'dark' | 'light';
  c: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
}
const ThemeContext = createContext<Theme>({ scheme: 'dark', c: themes.dark, spacing, radius, fontSize });

/** Dark is FORMA's primary look; light mode is fully supported. */
export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const scheme: 'dark' | 'light' = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => ({ scheme, c: themes[scheme], spacing, radius, fontSize }), [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
