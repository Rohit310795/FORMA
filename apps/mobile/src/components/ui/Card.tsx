import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';

interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'surface' | 'raised' | 'hero' | 'outline';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({ children, onPress, style, variant = 'surface', accessibilityLabel, accessibilityHint }: Props) {
  const { c, radius, spacing, scheme } = useTheme();
  const base: ViewStyle = { borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' };
  const content =
    variant === 'hero' ? (
      <LinearGradient
        colors={scheme === 'dark' ? ['#2A2350', '#171428', '#0F1C2B'] : ['#ECE8FF', '#F9EEFB', '#E8F4FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[base, { borderWidth: 1, borderColor: c.border }, style]}>
        {children}
      </LinearGradient>
    ) : (
      <View
        style={[
          base,
          {
            backgroundColor: variant === 'outline' ? 'transparent' : variant === 'raised' ? c.surfaceRaised : c.surface,
            borderWidth: 1,
            borderColor: c.border,
          },
          style,
        ]}>
        {children}
      </View>
    );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      {content}
    </Pressable>
  );
}
