import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MOBILITY_MAP } from '@forma/shared';
import { useMutations } from '@/lib/data';
import { newId, nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { useTheme } from '@/lib/theme';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';
import { ProgressRing } from '@/components/charts/Charts';

export default function MobilityRoutine() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = MOBILITY_MAP.get(id ?? '');
  const today = useToday();
  const { save } = useMutations();
  const { c } = useTheme();
  const [step, setStep] = useState(-1);
  const [left, setLeft] = useState(0);
  const [startedAt] = useState(Date.now());
  const [discomfort, setDiscomfort] = useState(0);
  const [done, setDone] = useState(false);
  const current = r && step >= 0 ? r.steps[step] : undefined;
  const duration = current?.durationSec ? current.durationSec * (current.perSide ? 2 : 1) : 0;

  useEffect(() => {
    if (!current?.durationSec) return;
    setLeft(duration);
    const t = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (current?.durationSec && left === 0 && step >= 0) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <Screen title="Routine" back><Banner tone="warning">Routine not found.</Banner></Screen>;

  const finish = async () => {
    const sid = newId();
    await save('mobilitySessions', sid, { id: sid, dayKey: today, routineId: r.id, completedSteps: Math.max(0, step + 1), totalSteps: r.steps.length, durationMin: Math.round((Date.now() - startedAt) / 60000), discomfort, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    setDone(true);
  };

  if (done) return (
    <Screen title="Nicely done" back>
      <Banner tone="success" title={`${r.name} logged`}>Consistency matters more than intensity for mobility.</Banner>
      <Button label="Back" onPress={() => router.back()} />
    </Screen>
  );

  return (
    <Screen title={r.name} subtitle={`${r.minutes} min · ${r.steps.length} moves`} back>
      {step < 0 ? (
        <>
          <Text tone="muted">{r.description}</Text>
          {r.steps.map((s, i) => (
            <Card key={i}>
              <Text variant="label">{i + 1}. {s.name}</Text>
              <Text variant="caption" tone="muted">{s.durationSec ? `${s.durationSec}s` : `${s.reps} reps`}{s.perSide ? ' each side' : ''} · {s.cue}</Text>
            </Card>
          ))}
          <Banner tone="info">Move within a comfortable range. Mild stretch is fine; stop if you feel sharp pain, numbness or tingling.</Banner>
          <Button label="Start routine" icon="play" onPress={() => setStep(0)} />
        </>
      ) : current ? (
        <>
          <Card style={{ alignItems: 'center', gap: 12 }}>
            <Text variant="overline" tone="primary">Move {step + 1} of {r.steps.length}</Text>
            <Text variant="title" style={{ textAlign: 'center' }}>{current.name}</Text>
            {current.durationSec ? (
              <ProgressRing value={duration - left} max={duration} size={160} label={`${left}s`} sublabel={current.perSide ? 'switch sides halfway' : undefined} />
            ) : (
              <Text variant="display">{current.reps}<Text variant="heading" tone="muted"> reps{current.perSide ? ' / side' : ''}</Text></Text>
            )}
            <Text tone="muted" style={{ textAlign: 'center' }}>{current.cue}</Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Back" variant="secondary" disabled={step === 0} onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
            {step < r.steps.length - 1 ? <Button label="Next" onPress={() => setStep((s) => s + 1)} style={{ flex: 2 }} /> : <Button label="Finish" onPress={() => setStep(r.steps.length)} style={{ flex: 2 }} />}
          </View>
        </>
      ) : (
        <Card style={{ gap: 12 }}>
          <Text variant="heading">Any discomfort during the routine?</Text>
          <Stepper label="0 none – 10 worst" value={discomfort} min={0} max={10} onChange={setDiscomfort} />
          {discomfort >= 5 ? <Banner tone="warning">Thanks — consider logging details in Recovery so FORMA can adjust suggestions.</Banner> : null}
          <Button label="Save session" onPress={finish} />
        </Card>
      )}
      <View style={{ height: 4, backgroundColor: c.border }} />
    </Screen>
  );
}
