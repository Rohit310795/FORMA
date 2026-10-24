import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';
import { Button } from './Button';

export function Banner({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children?: ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  const { c, radius } = useTheme();
  const color = { info: c.info, warning: c.warning, danger: c.danger, success: c.success }[tone];
  const defaultIcon = { info: 'information-circle', warning: 'alert-circle', danger: 'warning', success: 'checkmark-circle' }[tone] as keyof typeof Ionicons.glyphMap;
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: color, backgroundColor: c.surface }}>
      <Ionicons name={icon ?? defaultIcon} size={22} color={color} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text variant="label" style={{ color }}>{title}</Text> : null}
        {typeof children === 'string' ? <Text variant="caption" tone="muted">{children}</Text> : children}
      </View>
    </View>
  );
}

export function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction }: { icon?: keyof typeof Ionicons.glyphMap; title: string; message?: string; actionLabel?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={28} color={c.primary} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      {message ? <Text variant="caption" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>{message}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityLabel={label} style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={c.primary} />
      <Text variant="caption" tone="muted">{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="heading" accessibilityRole="header">{title}</Text>
      {action && onAction ? (
        <Text variant="label" tone="primary" onPress={onAction} accessibilityRole="button" style={{ paddingVertical: 8 }}>{action}</Text>
      ) : null}
    </View>
  );
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger' }) {
  const { c, radius } = useTheme();
  const color = { default: c.textMuted, primary: c.primary, success: c.success, warning: c.warning, danger: c.danger }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: color }}>
      <Text variant="caption" style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** A number with what it is, where it came from and whether it's an estimate — never a bare metric. */
export function Stat({ label, value, unit, note, icon, tone }: { label: string; value: string; unit?: string; note?: string; icon?: keyof typeof Ionicons.glyphMap; tone?: 'primary' | 'accent' }) {
  const { c, radius } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}${note ? `. ${note}` : ''}`} style={{ flex: 1, minWidth: 140, padding: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={16} color={tone === 'accent' ? c.accent : c.primary} /> : null}
        <Text variant="caption" tone="muted">{label}</Text>
      </View>
      <Text variant="title" style={{ fontSize: 22 }}>
        {value}
        {unit ? <Text variant="caption" tone="muted">{` ${unit}`}</Text> : null}
      </Text>
      {note ? <Text variant="caption" tone="subtle" numberOfLines={2}>{note}</Text> : null}
    </View>
  );
}

export function Row({ children, gap = 12, wrap }: { children: ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'stretch' }}>{children}</View>;
}
