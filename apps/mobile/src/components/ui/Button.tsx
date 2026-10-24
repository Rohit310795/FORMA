import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { minTouchTarget, palette } from '@forma/shared';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'sm';
  style?: ViewStyle;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, size = 'md', style, accessibilityHint, testID }: Props) {
  const { c, radius, spacing } = useTheme();
  const height = size === 'sm' ? 40 : 52;
  const inactive = disabled || loading;
  const fg = variant === 'primary' ? palette.ink900 : variant === 'danger' ? c.danger : variant === 'ghost' ? c.primary : c.text;
  const inner = (
    <View style={{ height: Math.max(height, size === 'sm' ? 40 : minTouchTarget), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      <Text variant="label" style={{ color: fg, fontSize: size === 'sm' ? 14 : 16 }}>{label}</Text>
    </View>
  );
  return (
    <Pressable
      testID={testID}
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [{ borderRadius: radius.pill, overflow: 'hidden', opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {variant === 'primary' ? (
        <LinearGradient colors={[c.gradientStart, c.gradientMid, c.gradientEnd]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}>{inner}</LinearGradient>
      ) : (
        <View style={{ backgroundColor: variant === 'secondary' ? c.surfaceRaised : 'transparent', borderWidth: variant === 'ghost' ? 0 : 1, borderColor: variant === 'danger' ? c.danger : c.border, borderRadius: radius.pill }}>{inner}</View>
      )}
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, tone = 'default' }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: 'default' | 'primary' | 'danger' }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceRaised, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={20} color={tone === 'primary' ? c.primary : tone === 'danger' ? c.danger : c.text} />
    </Pressable>
  );
}
