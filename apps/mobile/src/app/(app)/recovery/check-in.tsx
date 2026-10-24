import { useState } from 'react';
import { router } from 'expo-router';
import { recoveryCheckInSchema, recoveryEstimate, type RecoveryCheckIn } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented, Stepper, Toggle } from '@/components/ui/Controls';

const scale = (labels: string[]) => labels.map((l, i) => ({ value: String(i + 1), label: l }));

export default function CheckIn() {
  const today = useToday();
  const { profile } = useProfile();
  const { items } = useCollection<RecoveryCheckIn>('recoveryCheckIns', { orderBy: 'dayKey', limit: 3 });
  const { save } = useMutations();
  const existing = items.find((x) => x.dayKey === today);
  const [sleepHours, setSleepHours] = useState(existing?.sleepHours ?? 7);
  const [sleepQuality, setSleepQuality] = useState(existing?.sleepQuality ?? 3);
  const [soreness, setSoreness] = useState(existing?.soreness ?? 2);
  const [fatigue, setFatigue] = useState(existing?.fatigue ?? 2);
  const [stress, setStress] = useState(existing?.stress ?? 2);
  const [discomfort, setDiscomfort] = useState(existing?.discomfortReported ?? false);
  const preview = recoveryEstimate({ checkIn: { sleepHours, sleepQuality, soreness, fatigue, stress, discomfortReported: discomfort }, sleepTargetHours: profile?.sleepTargetHours });

  const submit = async () => {
    const id = existing?.id ?? `c${today.replace(/-/g, '')}`;
    const rec = recoveryCheckInSchema.parse({ id, dayKey: today, sleepHours, sleepQuality, soreness, fatigue, stress, discomfortReported: discomfort, sorenessAreas: [], createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso(), revision: (existing?.revision ?? 0) + 1, source: 'manual' });
    await save('recoveryCheckIns', id, rec);
    if (discomfort) router.replace('/recovery/discomfort');
    else router.back();
  };

  return (
    <Screen title="Recovery check-in" subtitle="About 20 seconds" back>
      <Card style={{ gap: 16 }}>
        <Stepper label="Hours slept" value={sleepHours} step={0.5} min={0} max={14} onChange={setSleepHours} />
        <Text variant="label">Sleep quality</Text>
        <Segmented options={scale(['Poor', 'Fair', 'OK', 'Good', 'Great'])} value={String(sleepQuality)} onChange={(v) => setSleepQuality(Number(v))} />
        <Text variant="label">Muscle soreness</Text>
        <Segmented options={scale(['None', 'Mild', 'Some', 'Sore', 'Very'])} value={String(soreness)} onChange={(v) => setSoreness(Number(v))} />
        <Text variant="label">Fatigue</Text>
        <Segmented options={scale(['Fresh', 'Fine', 'Meh', 'Tired', 'Drained'])} value={String(fatigue)} onChange={(v) => setFatigue(Number(v))} />
        <Text variant="label">Stress</Text>
        <Segmented options={scale(['Calm', 'Low', 'Some', 'High', 'Very'])} value={String(stress)} onChange={(v) => setStress(Number(v))} />
        <Toggle label="Any joint or muscle discomfort?" description="You’ll be able to add details next." value={discomfort} onChange={setDiscomfort} />
      </Card>
      <Card>
        <Text variant="label">Estimate preview: {preview.score ?? '—'}/100</Text>
        <Text variant="caption" tone="muted">{preview.explanation}</Text>
        <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>{preview.disclaimer}</Text>
      </Card>
      <Button label="Save check-in" testID="save-checkin" onPress={submit} />
    </Screen>
  );
}
