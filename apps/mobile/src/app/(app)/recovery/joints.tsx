import { router, useLocalSearchParams } from 'expo-router';
import { EXERCISE_MAP, JOINT_EDUCATION, MOBILITY_MAP, type Joint } from '@forma/shared';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChipGroup, ListRow } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';

export default function Joints() {
  const params = useLocalSearchParams<{ joint?: string }>();
  const joint = (JOINT_EDUCATION.find((j) => j.joint === params.joint) ?? JOINT_EDUCATION[1]!).joint;
  const edu = JOINT_EDUCATION.find((j) => j.joint === joint)!;
  return (
    <Screen title="Joint strengthening" subtitle="General education" back>
      <ChipGroup scroll options={JOINT_EDUCATION.map((j) => ({ value: j.joint, label: j.title.replace(' basics', '').replace(' health', '') }))} value={joint} onChange={(v) => (v === 'knee' ? router.push('/recovery/knee') : router.setParams({ joint: v as Joint }))} />
      <Card><Text variant="heading" style={{ marginBottom: 6 }}>{edu.title}</Text><Text tone="muted">{edu.intro}</Text></Card>
      <Card>
        <Text variant="heading" style={{ marginBottom: 6 }}>Strength options</Text>
        {edu.exerciseIds.map((id) => <ListRow key={id} title={EXERCISE_MAP.get(id)?.name ?? id} subtitle={EXERCISE_MAP.get(id)?.difficulty} onPress={() => router.push(`/exercises/${id}`)} />)}
        <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>Progression: {edu.progression}</Text>
      </Card>
      <Card>
        <Text variant="heading" style={{ marginBottom: 6 }}>Mobility</Text>
        {edu.mobilityRoutineIds.map((id) => <ListRow key={id} icon="leaf-outline" title={MOBILITY_MAP.get(id)?.name ?? id} onPress={() => router.push(`/mobility/${id}`)} />)}
      </Card>
      <Card>
        <Text variant="heading" style={{ marginBottom: 6 }}>Everyday tips</Text>
        {edu.activityTips.map((t) => <Text key={t} tone="muted">• {t}</Text>)}
      </Card>
      <Banner tone="warning" title="When to get checked">{edu.seekCare.map((s) => `• ${s}`).join('\n')}</Banner>
      <Button label={`Log ${edu.joint.replace('_', ' ')} discomfort`} variant="secondary" onPress={() => router.push(`/recovery/discomfort?joint=${edu.joint}`)} />
    </Screen>
  );
}
