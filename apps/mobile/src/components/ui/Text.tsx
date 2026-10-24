import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/lib/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'overline';
type Tone = 'default' | 'muted' | 'subtle' | 'primary' | 'accent' | 'danger' | 'warning' | 'success' | 'inverse';

const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  overline: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps & { variant?: Variant; tone?: Tone }) {
  const { c } = useTheme();
  const color = {
    default: c.text,
    muted: c.textMuted,
    subtle: c.textSubtle,
    primary: c.primary,
    accent: c.accent,
    danger: c.danger,
    warning: c.warning,
    success: c.success,
    inverse: c.primaryText,
  }[tone];
  return <RNText maxFontSizeMultiplier={1.6} style={[VARIANTS[variant], { color }, style]} {...rest} />;
}
