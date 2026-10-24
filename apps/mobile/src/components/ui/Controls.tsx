import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';

export function Chip({ label, selected, onPress, icon, testID }: { label: string; selected?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; testID?: string }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: selected ? c.primary : c.surfaceRaised,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? c.primaryText : c.textMuted} /> : null}
      <Text variant="label" style={{ color: selected ? c.primaryText : c.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({ options, value, onChange, multi, scroll }: { options: { value: T; label: string }[]; value: T | T[]; onChange: (v: T | T[]) => void; multi?: boolean; scroll?: boolean }) {
  const selected = Array.isArray(value) ? value : [value];
  const toggle = (v: T) => {
    if (!multi) return onChange(v);
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  const chips = options.map((o) => <Chip key={o.value} label={o.label} selected={selected.includes(o.value)} onPress={() => toggle(o.value)} />);
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{chips}</ScrollView>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c, radius } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: c.surfaceSunken, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: c.border }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.primary : 'transparent', paddingHorizontal: 8 }}>
            <Text variant="label" numberOfLines={1} style={{ color: active ? c.primaryText : c.textMuted, fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string; style?: ViewStyle }) {
  const { c, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text variant="label" tone="muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={c.textSubtle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ minHeight: 48, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, color: c.text, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: error ? c.danger : focused ? c.primary : c.border }}
        {...props}
      />
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : hint ? <Text variant="caption" tone="subtle">{hint}</Text> : null}
    </View>
  );
}

export function NumberField({ label, value, onChange, unit, hint, step = 1, min, max, decimals = 0 }: { label: string; value?: number; onChange: (v: number | undefined) => void; unit?: string; hint?: string; step?: number; min?: number; max?: number; decimals?: number }) {
  const [text, setText] = useState(value !== undefined ? String(value) : '');
  return (
    <Field
      label={unit ? `${label} (${unit})` : label}
      hint={hint}
      value={text}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      inputMode={decimals ? 'decimal' : 'numeric'}
      onChangeText={(t) => {
        setText(t);
        const n = Number(t.replace(',', '.'));
        if (t.trim() === '' || Number.isNaN(n)) return onChange(undefined);
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
        onChange(decimals ? Math.round(clamped * 10 ** decimals) / 10 ** decimals : Math.round(clamped / step) * step);
      }}
    />
  );
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999, format }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string }) {
  const { c } = useTheme();
  const btn = (icon: 'remove' | 'add', delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${icon === 'add' ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)))}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceRaised, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={22} color={c.text} />
    </Pressable>
  );
  return (
    <View accessible accessibilityLabel={`${label}: ${format ? format(value) : value}`} style={{ alignItems: 'center', gap: 6 }}>
      <Text variant="caption" tone="muted">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {btn('remove', -step)}
        <Text variant="title" style={{ minWidth: 72, textAlign: 'center' }}>{format ? format(value) : value}</Text>
        {btn('add', step)}
      </View>
    </View>
  );
}

export function Toggle({ label, description, value, onChange, testID }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {description ? <Text variant="caption" tone="muted">{description}</Text> : null}
      </View>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.primary, false: c.border }} thumbColor="#FFFFFF" />
    </View>
  );
}

export function ListRow({ icon, title, subtitle, right, onPress, tone, testID }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; tone?: 'danger'; testID?: string }) {
  const { c, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={tone === 'danger' ? c.danger : c.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="label" tone={tone === 'danger' ? 'danger' : 'default'}>{title}</Text>
        {subtitle ? <Text variant="caption" tone="muted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={c.textSubtle} /> : null)}
    </Pressable>
  );
}
