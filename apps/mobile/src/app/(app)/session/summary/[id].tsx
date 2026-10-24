import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EXERCISE_MAP, completedSetCount, formatWeight, newRecordsInSession, sessionDurationMin, sessionVolumeKg } from '@forma/shared';
import { useProfile } from '@/lib/profile';
import { useMutations } from '@/lib/data';
import { confirm } from '@/lib/confirm';
import { nowIso } from '@/lib/ids';
import { useSessions } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Banner, Badge, Loading, Row, SectionHeader, Stat } from '@/components/ui/Feedback';

export default function SessionSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, loading } = useSessions();
  const { profile } = useProfile();
  const { save } = useMutations();
  const units = profile?.units ?? 'metric';
  const s = items.find((x) => x.id === id);
  const records = useMemo(() => (s ? newRecordsInSession(s, items) : []), [s, items]);
  if (!s) return <Screen title="Workout" back>{loading ? <Loading /> : <Banner tone="warning">Workout not found.</Banner>}</Screen>;
  return (
    <Screen title={s.status === 'completed' ? 'Workout complete' : s.name} subtitle={`${s.name} · ${s.dayKey}`} back>
      {s._pending ? <Banner tone="info" title="Saved on this device">It will sync automatically when you’re online.</Banner> : null}
      <Row wrap>
        <Stat icon="time-outline" label="Duration" value={`${sessionDurationMin(s) ?? '–'}`} unit="min" note="Excludes pauses" />
        <Stat icon="layers-outline" label="Working sets" value={`${completedSetCount(s)}`} note="Completed sets only" />
        <Stat icon="barbell-outline" label="Volume" value={formatWeight(sessionVolumeKg(s), units, 0)} note="Reps × load, working sets" />
        {s.effort ? <Stat icon="speedometer-outline" label="Effort" value={`${s.effort}`} unit="/ 10" note="Your rating" /> : null}
      </Row>
      {records.length ? (
        <Card variant="hero">
          <Text variant="overline" tone="accent">New personal records</Text>
          {records.map((r, i) => (
            <Text key={i} variant="label" style={{ marginTop: 6 }}>
              {EXERCISE_MAP.get(r.exerciseId)?.name}: {r.kind === 'heaviest' ? `heaviest set ${formatWeight(r.value, units)} × ${r.reps}` : `estimated 1RM ${formatWeight(r.value, units)}`}
            </Text>
          ))}
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>Based on your logged sets. Estimated 1RM uses the Epley formula.</Text>
        </Card>
      ) : null}
      <SectionHeader title="Exercises" />
      {s.exercises.map((e) => {
        const ex = EXERCISE_MAP.get(e.exerciseId);
        const done = e.sets.filter((x) => x.completed);
        return (
          <Card key={e.key}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="label">{ex?.name ?? e.exerciseId}</Text>
              {e.substitutedFrom ? <Badge label="Swapped" /> : null}
            </View>
            <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {done.length ? done.map((x) => (ex?.timed ? `${x.durationSec}s` : `${x.reps}${x.weightKg ? ` × ${formatWeight(x.weightKg, units)}` : ''}`) + (x.kind === 'warmup' ? ' (warm-up)' : '')).join(' · ') : 'No sets completed'}
            </Text>
            {e.discomfort ? <Text variant="caption" tone="warning" style={{ marginTop: 4 }}>Discomfort reported: {e.discomfort.area}, {e.discomfort.severity}/10{e.discomfort.sharp ? ', sharp' : ''}</Text> : null}
            {e.note ? <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>{e.note}</Text> : null}
          </Card>
        );
      })}
      {s.exercises.some((e) => e.discomfort && (e.discomfort.sharp || e.discomfort.severity >= 5)) ? (
        <Banner tone="warning" title="You reported discomfort">Consider logging it in Knee Health / Recovery so future plans can adapt. Seek professional advice if pain is sharp, persists or worsens.</Banner>
      ) : null}
      <Button label="Done" onPress={() => router.replace('/')} />
      <Button label="Recovery check-in" variant="secondary" onPress={() => router.push('/recovery/check-in')} />
      {s.status === 'completed' ? (
        <Button
          label="Delete this workout"
          variant="ghost"
          onPress={async () => {
            if (!(await confirm('Delete workout?', 'This removes it from your history and progress.', 'Delete'))) return;
            await save('workoutSessions', s.id, { ...s, status: 'abandoned', updatedAt: nowIso(), revision: (s.revision ?? 0) + 1 });
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}
