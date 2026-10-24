import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EXERCISES, EQUIPMENT, EQUIPMENT_LABELS, EXERCISE_TYPES, DIFFICULTY, type Exercise } from '@forma/shared';
import { useTheme } from '@/lib/theme';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { ChipGroup, Field, ListRow } from '@/components/ui/Controls';
import { MUSCLE_LABELS } from '@/components/BodyMap';

export default function ExerciseLibrary() {
  const params = useLocalSearchParams<{ type?: string; muscle?: string }>();
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>(params.type ?? 'all');
  const [equipment, setEquipment] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return EXERCISES.filter(
      (e: Exercise) =>
        (type === 'all' || e.type === type) &&
        (equipment === 'all' || e.equipment.includes(equipment as never)) &&
        (difficulty === 'all' || e.difficulty === difficulty) &&
        (!params.muscle || e.primaryMuscles.includes(params.muscle as never) || e.secondaryMuscles.includes(params.muscle as never)) &&
        (!query || e.name.toLowerCase().includes(query) || [...e.primaryMuscles, ...e.secondaryMuscles].some((m) => MUSCLE_LABELS[m].toLowerCase().includes(query))),
    );
  }, [q, type, equipment, difficulty, params.muscle]);
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

  return (
    <Screen title="Exercise library" subtitle={params.muscle ? `Targeting ${MUSCLE_LABELS[params.muscle as keyof typeof MUSCLE_LABELS]}` : `${EXERCISES.length} exercises`} back scroll={false}>
      <Field label="Search" placeholder="e.g. squat, glutes, band" value={q} onChangeText={setQ} />
      <ChipGroup scroll options={[{ value: 'all', label: 'All types' }, ...EXERCISE_TYPES.map((t) => ({ value: t, label: cap(t) }))]} value={type} onChange={(v) => setType(v as string)} />
      <ChipGroup scroll options={[{ value: 'all', label: 'Any equipment' }, ...EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))]} value={equipment} onChange={(v) => setEquipment(v as string)} />
      <ChipGroup scroll options={[{ value: 'all', label: 'Any level' }, ...DIFFICULTY.map((d) => ({ value: d, label: cap(d) }))]} value={difficulty} onChange={(v) => setDifficulty(v as string)} />
      <FlatList
        style={{ flex: 1 }}
        data={list}
        keyExtractor={(e) => e.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
        ListEmptyComponent={<Text tone="muted">No exercises match these filters.</Text>}
        renderItem={({ item }) => (
          <ListRow
            icon={item.type === 'mobility' ? 'leaf-outline' : item.type === 'cardio' ? 'bicycle-outline' : item.type === 'core' ? 'ellipse-outline' : 'barbell-outline'}
            title={item.name}
            subtitle={`${item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · ${item.equipment.map((e) => EQUIPMENT_LABELS[e]).join(' / ')} · ${item.difficulty}`}
            onPress={() => router.push(`/exercises/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}
