import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { EXERCISES, EXERCISE_MAP, MOBILITY_ROUTINES, daysBetween, muscleVolume, type Muscle } from '@forma/shared';
import { useMutations, useUserDoc } from '@/lib/data';
import { nowIso } from '@/lib/ids';
import { useSessions, useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Segmented, ListRow } from '@/components/ui/Controls';
import { Banner, Row, Stat } from '@/components/ui/Feedback';
import { BodyMap, MUSCLE_LABELS, FRONT_MUSCLES } from '@/components/BodyMap';

type Priority = 'priority' | 'maintain' | 'reduce';

export default function Muscles() {
  const today = useToday();
  const { items: sessions } = useSessions();
  const { data: prefs } = useUserDoc<{ priorities: Partial<Record<Muscle, Priority>> }>('settings', 'musclePriorities');
  const { save } = useMutations();
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [selected, setSelected] = useState<Muscle>('chest');
  const stats = useMemo(() => muscleVolume(sessions, EXERCISE_MAP, today, 7), [sessions, today]);
  const intensity = useMemo(() => Object.fromEntries([...stats.entries()].map(([m, s]) => [m, Math.min(1, s.sets / 12)])) as Partial<Record<Muscle, number>>, [stats]);
  const stat = stats.get(selected);
  const primary = EXERCISES.filter((e) => e.primaryMuscles.includes(selected));
  const secondary = EXERCISES.filter((e) => e.secondaryMuscles.includes(selected));
  const priority = prefs?.priorities?.[selected] ?? 'maintain';
  const related = MOBILITY_ROUTINES.filter((r) => ({ hamstrings: 'hamstrings', quads: 'quads', calves: 'calves', glutes: 'hips', hipAbductors: 'hips', adductors: 'hips', chest: 'shoulders', frontDelts: 'shoulders', sideDelts: 'shoulders', rearDelts: 'shoulders', upperBack: 'thoracic', traps: 'neck', neck: 'neck', lowerBack: 'hips' } as Record<string, string>)[selected] === r.area);

  return (
    <Screen title="My muscles" subtitle="Last 7 days of logged training" back>
      <Segmented options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]} value={side} onChange={setSide} />
      <BodyMap side={side} intensity={intensity} selected={selected} onSelect={(m) => setSelected(m)} />
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>Colour shows logged working sets (secondary muscles count half). It doesn’t show recovery or injury.</Text>
      <Card style={{ gap: 12 }}>
        <Text variant="title" style={{ fontSize: 22 }}>{MUSCLE_LABELS[selected]}</Text>
        <Row wrap>
          <Stat label="Sets (7 days)" value={stat ? String(Math.round(stat.sets * 10) / 10) : '0'} note="From completed sessions" />
          <Stat label="Last trained" value={stat?.lastTrained ? `${daysBetween(stat.lastTrained, today)}d ago` : '—'} note={stat?.lastTrained ?? 'Not logged yet'} />
        </Row>
        <Text variant="label">Training emphasis</Text>
        <Segmented
          options={[{ value: 'priority', label: 'Priority' }, { value: 'maintain', label: 'Maintain' }, { value: 'reduce', label: 'Reduce' }]}
          value={priority}
          onChange={(v) => save('settings', 'musclePriorities', { priorities: { ...(prefs?.priorities ?? {}), [selected]: v }, updatedAt: nowIso() })}
        />
        <Text variant="caption" tone="muted">Used when building and adjusting plans. It never overrides your avoid list or clinician instructions.</Text>
      </Card>
      {!FRONT_MUSCLES.has(selected) && side === 'front' ? <Banner tone="info">Switch to Back to see this muscle highlighted.</Banner> : null}
      <Card>
        <Text variant="heading" style={{ marginBottom: 6 }}>Exercises — primary</Text>
        {primary.slice(0, 10).map((e) => <ListRow key={e.id} title={e.name} subtitle={e.equipment.join(' / ')} onPress={() => router.push(`/exercises/${e.id}`)} />)}
        {secondary.length ? <Text variant="heading" style={{ marginVertical: 6 }}>Also works it</Text> : null}
        {secondary.slice(0, 6).map((e) => <ListRow key={e.id} title={e.name} subtitle="Secondary involvement" onPress={() => router.push(`/exercises/${e.id}`)} />)}
      </Card>
      {related.length ? (
        <Card>
          <Text variant="heading" style={{ marginBottom: 6 }}>Mobility & recovery</Text>
          {related.map((r) => <ListRow key={r.id} icon="leaf-outline" title={r.name} subtitle={`${r.minutes} min`} onPress={() => router.push(`/mobility/${r.id}`)} />)}
        </Card>
      ) : null}
      <View style={{ height: 8 }} />
    </Screen>
  );
}
