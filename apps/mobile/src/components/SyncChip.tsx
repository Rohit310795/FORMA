import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import type { OutboxState } from '@/lib/outbox';

/** Shows honest sync status: "Saved on device" until the server confirms. */
export function SyncChip({ state }: { state: OutboxState }) {
  const { c, radius } = useTheme();
  const pending = state.pending.length;
  const label = state.syncing ? 'Syncing…' : pending ? `${pending} waiting to sync` : 'Synced';
  const color = pending ? (state.lastError ? c.warning : c.info) : c.success;
  return (
    <View accessible accessibilityLabel={pending ? `${label}. Saved on this device.` : label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <Ionicons name={pending ? 'cloud-upload-outline' : 'cloud-done-outline'} size={14} color={color} />
      <Text variant="caption" style={{ color, fontSize: 11 }}>{label}</Text>
    </View>
  );
}
