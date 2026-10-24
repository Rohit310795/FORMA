import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EQUIPMENT_LABELS, EXERCISE_MAP, MOBILITY_ROUTINES, getExercise } from '@forma/shared';
import { useProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Badge, Banner } from '@/components/ui/Feedback';
import { MUSCLE_LABELS } from '@/components/BodyMap';

function Bullets({ items, numbered }: { items: string[]; numbered?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: numbered ? c.primary : c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" style={{ color: numbered ? c.primaryText : c.textMuted, fontWeight: '700' }}>{numbered ? i + 1 : '•'}</Text>
          </View>
          <Text style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = getExercise(id ?? '');
  const { profile, save } = useProfile();
  const [tab, setTab] = useState<'how' | 'muscles' | 'variations'>('how');
  if (!ex) return <Screen title="Exercise" back><Banner tone="warning">Exercise not found.</Banner></Screen>;
  const avoided = profile?.avoidedExerciseIds?.includes(ex.id);
  const preferred = profile?.preferredExerciseIds?.includes(ex.id);
  const linkOrText = (v: string) => EXERCISE_MAP.get(v);
  const mobility = MOBILITY_ROUTINES.filter((r) => ex.primaryMuscles.some((m) => (m === 'hamstrings' && r.area === 'hamstrings') || (m === 'quads' && r.area === 'quads') || (['frontDelts', 'sideDelts', 'rearDelts', 'chest'].includes(m) && r.area === 'shoulders') || (m === 'calves' && r.area === 'calves') || (m === 'glutes' && r.area === 'hips')));

  return (
    <Screen title={ex.name} back>
      <Card variant="hero">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Badge label={ex.difficulty} tone="primary" />
          <Badge label={ex.type} />
          {ex.equipment.map((e) => <Badge key={e} label={EQUIPMENT_LABELS[e]} />)}
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: 10 }}>
          Video demonstrations will appear here once licensed media is added. Until then, follow the step-by-step instructions below.
        </Text>
      </Card>
      <Segmented options={[{ value: 'how', label: 'Instructions' }, { value: 'muscles', label: 'Muscles' }, { value: 'variations', label: 'Variations' }]} value={tab} onChange={setTab} />
      {tab === 'how' && (
        <>
          <Card><Text variant="heading" style={{ marginBottom: 10 }}>Steps</Text><Bullets items={ex.instructions} numbered /></Card>
          {ex.formCues.length ? <Card><Text variant="heading" style={{ marginBottom: 10 }}>Form cues</Text><Bullets items={ex.formCues} /></Card> : null}
          {ex.commonMistakes.length ? <Card><Text variant="heading" style={{ marginBottom: 10 }}>Common mistakes</Text><Bullets items={ex.commonMistakes} /></Card> : null}
          {ex.breathing ? <Card><Text variant="heading" style={{ marginBottom: 6 }}>Breathing</Text><Text tone="muted">{ex.breathing}</Text></Card> : null}
          <Banner tone="warning" title="Safety">{[...ex.safety, 'Stop if you feel sharp or worsening pain.'].join(' ')}</Banner>
        </>
      )}
      {tab === 'muscles' && (
        <Card style={{ gap: 8 }}>
          <Text variant="label">Primary</Text>
          <Text tone="muted">{ex.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}</Text>
          {ex.secondaryMuscles.length ? (<><Text variant="label">Secondary</Text><Text tone="muted">{ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}</Text></>) : null}
          {ex.mobilityPrereqs.length ? (<><Text variant="label">Helpful mobility</Text><Text tone="muted">{ex.mobilityPrereqs.join(', ')}</Text></>) : null}
          {mobility.slice(0, 3).map((r) => <Button key={r.id} label={r.name} variant="ghost" size="sm" onPress={() => router.push(`/mobility/${r.id}`)} />)}
        </Card>
      )}
      {tab === 'variations' && (
        <Card style={{ gap: 10 }}>
          {[['Easier', ex.easier], ['Harder / progression', ex.harder], ['Substitutions', ex.substitutions]].map(([label, list]) =>
            (list as string[]).length ? (
              <View key={label as string} style={{ gap: 6 }}>
                <Text variant="label">{label as string}</Text>
                {(list as string[]).map((v) => {
                  const linked = linkOrText(v);
                  return linked ? <Button key={v} label={linked.name} size="sm" variant="secondary" onPress={() => router.push(`/exercises/${linked.id}`)} /> : <Text key={v} tone="muted">• {v}</Text>;
                })}
              </View>
            ) : null,
          )}
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label={preferred ? 'Preferred ✓' : 'Prefer'}
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => save({ preferredExerciseIds: preferred ? profile!.preferredExerciseIds.filter((x) => x !== ex.id) : [...(profile?.preferredExerciseIds ?? []), ex.id] })}
        />
        <Button
          label={avoided ? 'Avoided ✓' : 'Avoid'}
          variant={avoided ? 'danger' : 'secondary'}
          style={{ flex: 1 }}
          onPress={() => save({ avoidedExerciseIds: avoided ? profile!.avoidedExerciseIds.filter((x) => x !== ex.id) : [...(profile?.avoidedExerciseIds ?? []), ex.id] })}
        />
      </View>
    </Screen>
  );
}
