import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EXERCISES, EQUIPMENT_LABELS, filterExercises, type Exercise, type ClinicianInstruction, type DiscomfortLog } from '@forma/shared';
import { useTheme } from '@/lib/theme';
import { useCollection } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useToday } from '@/features/hooks';
import { Text } from '@/components/ui/Text';
import { Field, Chip } from '@/components/ui/Controls';
import { IconButton } from '@/components/ui/Button';
import { MUSCLE_LABELS } from '@/components/BodyMap';

/** Exercise search that hides anything excluded by clinician instructions, the avoid list or current discomfort. */
export function ExercisePicker({ visible, onClose, onPick, title = 'Choose exercise', suggestIds }: { visible: boolean; onClose: () => void; onPick: (e: Exercise) => void; title?: string; suggestIds?: string[] }) {
  const { c } = useTheme();
  const today = useToday();
  const { profile } = useProfile();
  const { items: discomfort } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 20 });
  const { items: clinician } = useCollection<ClinicianInstruction>('clinicianInstructions');
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(true);
  const filtered = useMemo(() => {
    const { allowed } = filterExercises(EXERCISES, { today, discomfortLogs: discomfort, clinicianInstructions: clinician, avoidedExerciseIds: profile?.avoidedExerciseIds });
    const eq = new Set([...(profile?.equipment ?? []), 'bodyweight']);
    const query = q.trim().toLowerCase();
    const list = allowed.filter(
      (e) =>
        (!mine || e.equipment.some((x) => eq.has(x))) &&
        (!query || e.name.toLowerCase().includes(query) || e.primaryMuscles.some((m) => MUSCLE_LABELS[m].toLowerCase().includes(query))),
    );
    const suggested = new Set(suggestIds ?? []);
    return [...list.filter((e) => suggested.has(e.id)), ...list.filter((e) => !suggested.has(e.id))];
  }, [today, discomfort, clinician, profile, q, mine, suggestIds]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="heading">{title}</Text>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <Field label="Search" placeholder="Name or muscle" value={q} onChangeText={setQ} autoFocus />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="My equipment" selected={mine} onPress={() => setMine(true)} />
            <Chip label="All equipment" selected={!mine} onPress={() => setMine(false)} />
          </View>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={<Text tone="muted">No matching exercises.</Text>}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}`}
              onPress={() => {
                onPick(item);
                onClose();
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{item.name}{suggestIds?.includes(item.id) && index < (suggestIds?.length ?? 0) ? '  · suggested' : ''}</Text>
                <Text variant="caption" tone="muted">{item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {item.equipment.map((e) => EQUIPMENT_LABELS[e]).join(' / ')} · {item.difficulty}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={c.primary} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
