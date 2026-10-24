/**
 * FORMA design tokens. Shared by the mobile app and the admin console so both
 * surfaces read as one product. Components must use these instead of raw colours.
 */

export const palette = {
  ink950: '#07070B',
  ink900: '#0D0D14',
  ink850: '#12121B',
  ink800: '#181824',
  ink700: '#232333',
  ink600: '#2F2F44',
  ink400: '#6B6B85',
  ink300: '#9A9AB2',
  ink200: '#C7C7D6',
  ink100: '#E9E9F1',
  ink50: '#F6F6FA',
  white: '#FFFFFF',
  violet500: '#8B7CF6',
  violet400: '#A79BFF',
  violet300: '#C4BBFF',
  orchid400: '#E39BEF',
  sky400: '#7CC4FF',
  lime400: '#B8F35A',
  lime500: '#9BDB3A',
  amber400: '#FFC25C',
  coral400: '#FF7A7A',
  teal400: '#4FD1C5',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  overlay: string;
  chartGrid: string;
}

export const themes: Record<'dark' | 'light', ThemeColors> = {
  dark: {
    background: palette.ink950,
    surface: palette.ink850,
    surfaceRaised: palette.ink800,
    surfaceSunken: palette.ink900,
    border: palette.ink700,
    text: palette.ink50,
    textMuted: palette.ink300,
    textSubtle: palette.ink400,
    primary: palette.violet400,
    primaryText: palette.ink950,
    accent: palette.lime400,
    success: palette.lime400,
    warning: palette.amber400,
    danger: palette.coral400,
    info: palette.sky400,
    gradientStart: palette.violet300,
    gradientMid: palette.orchid400,
    gradientEnd: palette.sky400,
    overlay: 'rgba(7,7,11,0.72)',
    chartGrid: palette.ink700,
  },
  light: {
    background: palette.ink50,
    surface: palette.white,
    surfaceRaised: palette.white,
    surfaceSunken: palette.ink100,
    border: palette.ink200,
    text: palette.ink950,
    textMuted: palette.ink400,
    textSubtle: palette.ink300,
    primary: palette.violet500,
    primaryText: palette.white,
    accent: palette.lime500,
    success: '#3E8E1F',
    warning: '#B26A00',
    danger: '#C93838',
    info: '#2D7FC1',
    gradientStart: palette.violet400,
    gradientMid: palette.orchid400,
    gradientEnd: palette.sky400,
    overlay: 'rgba(13,13,20,0.4)',
    chartGrid: palette.ink200,
  },
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 36 } as const;
export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const;
/** Minimum touch target (iOS HIG / WCAG 2.5.5 guidance). */
export const minTouchTarget = 44;
