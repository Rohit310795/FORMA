import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { EXERCISES, EXERCISE_MAP, MOBILITY_MAP, assessDiscomfort, filterExercises, getJointEducation, type ClinicianInstruction, type DiscomfortLog } from '@forma/shared';
import { useCollection } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Segmented, ListRow } from '@/components/ui/Controls';
import { Badge, Banner, EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { LineChart } from '@/components/charts/Charts';
import { SafetyCard } from '@/components/SafetyCard';

const SWAPS = [
  ['Deep squats', 'Box squat to a higher seat, leg press with limited depth, or sit-to-stand'],
  ['Lunges', 'Low step-ups or split squats with a shorter range'],
  ['Running or jumping', 'Cycling, swimming (freestyle), elliptical or brisk walking'],
  ['Kneeling exercises', 'Standing or seated versions, or use thick padding'],
  ['Leg extension (full range)', 'Partial range, isometric holds or terminal knee extensions'],
];

export default function KneeHealth() {
  const today = useToday();
  const { profile } = useProfile();
  const feature = useFeature('kneeHealth');
  const [tab, setTab] = useState<'exercises' | 'progress' | 'guidance'>('exercises');
  const { items: logs } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 60 });
  const { items: clinician } = useCollection<ClinicianInstruction>('clinicianInstructions');
  const edu = getJointEducation('knee')!;
  const kneeLogs = logs.filter((l) => l.joint === 'knee');
  const latest = kneeLogs[0] ? assessDiscomfort(kneeLogs[0]) : undefined;
  const filter = useMemo(() => filterExercises(EXERCISES, { today, discomfortLogs: logs, clinicianInstructions: clinician, avoidedExerciseIds: profile?.avoidedExerciseIds }), [today, logs, clinician, profile]);
  const excluded = new Map(filter.excluded.map((e) => [e.exerciseId, e]));
  const activeInstr = clinician.filter((i) => i.active && (!i.joint || i.joint === 'knee'));
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ text: string; note?: string }>();
  const [busy, setBusy] = useState(false);
  const ai = useFeature('kneeHealth');

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      const r = await api.aiChat({ routeKey: 'kneeEducation', message: question.trim() });
      setAnswer({ text: r.message.content, note: r.message.disclaimers.join(' ') });
    } catch (e) {
      setAnswer({ text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!feature.enabled) return <Screen title="Knee health" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Knee health" back right={<Button label="Log" size="sm" icon="add" onPress={() => router.push('/recovery/discomfort?joint=knee')} />}>
      <Segmented options={[{ value: 'exercises', label: 'Exercises' }, { value: 'progress', label: 'My progress' }, { value: 'guidance', label: 'Guidance' }]} value={tab} onChange={setTab} />
      {latest && latest.level !== 'ok' ? <SafetyCard assessment={latest} /> : null}
      {activeInstr.length ? (
        <Banner tone="info" title="Your clinician’s instructions come first">
          {activeInstr.map((i) => i.instructions).join(' • ')}
        </Banner>
      ) : null}

      {tab === 'exercises' && (
        <>
          <Text tone="muted">{edu.intro}</Text>
          <Card>
            {edu.exerciseIds.map((id) => {
              const ex = EXERCISE_MAP.get(id)!;
              const ex2 = excluded.get(id);
              return (
                <ListRow
                  key={id}
                  title={ex.name}
                  subtitle={ex2 ? ex2.detail : `${ex.difficulty} · ${ex.equipment.join(' / ')}`}
                  right={ex2 ? <Badge label="Set aside" tone="warning" /> : undefined}
                  onPress={() => router.push(`/exercises/${id}`)}
                />
              );
            })}
          </Card>
          <Card>
            <Text variant="heading" style={{ marginBottom: 6 }}>How to progress</Text>
            <Text tone="muted">{edu.progression}</Text>
          </Card>
          <SectionHeader title="Knee-friendly mobility" />
          {edu.mobilityRoutineIds.map((id) => {
            const r = MOBILITY_MAP.get(id)!;
            return <ListRow key={id} icon="leaf-outline" title={r.name} subtitle={`${r.minutes} min`} onPress={() => router.push(`/mobility/${id}`)} />;
          })}
          <Text variant="caption" tone="subtle">This is a general exercise education library, not a treatment plan. It is never assigned automatically from a pain score.</Text>
        </>
      )}

      {tab === 'progress' && (
        <>
          {!profile?.consent?.healthDetails ? (
            <Banner tone="info" title="Turn on health-detail storage to log discomfort">
              Discomfort logs are optional. Enable “Store discomfort logs and clinician notes” in Settings → Privacy.
            </Banner>
          ) : null}
          {kneeLogs.length ? (
            <>
              <Card>
                <Text variant="label">Knee discomfort over time (0–10)</Text>
                <LineChart data={kneeLogs.slice().reverse().map((l) => ({ x: l.dayKey, y: l.severity }))} emptyMessage="Log on at least two days to see a trend." />
              </Card>
              <Card>
                {kneeLogs.slice(0, 15).map((l) => <ListRow key={l.id} title={`${l.dayKey} · ${l.side} · ${l.location}`} subtitle={`${l.severity}/10 · ${l.trend.replace('_', ' ')}${l.aggravators.length ? ` · worse with ${l.aggravators.join(', ').replace(/_/g, ' ')}` : ''}`} />)}
              </Card>
            </>
          ) : (
            <EmptyState icon="walk-outline" title="No knee logs yet" message="Logging helps FORMA set aside movements that may aggravate things and shows how you’re trending." actionLabel="Log discomfort" onAction={() => router.push('/recovery/discomfort?joint=knee')} />
          )}
          <ListRow icon="document-text-outline" title="Clinician instructions" subtitle={activeInstr.length ? `${activeInstr.length} active` : 'Add instructions from your doctor or physio'} onPress={() => router.push('/clinician')} />
        </>
      )}

      {tab === 'guidance' && (
        <>
          <Card>
            <Text variant="heading" style={{ marginBottom: 6 }}>Everyday modifications</Text>
            {edu.activityTips.map((t) => <Text key={t} tone="muted" style={{ marginBottom: 6 }}>• {t}</Text>)}
          </Card>
          <Card>
            <Text variant="heading" style={{ marginBottom: 6 }}>Common swaps</Text>
            {SWAPS.map(([from, to]) => <Text key={from} tone="muted" style={{ marginBottom: 6 }}><Text variant="label">{from}: </Text>{to}</Text>)}
          </Card>
          <Banner tone="warning" title="When to get checked">
            {edu.seekCare.map((s) => `• ${s}`).join('\n')}
          </Banner>
          {ai.enabled ? (
            <Card variant="hero" style={{ gap: 10 }}>
              <Text variant="heading">Ask about knee health</Text>
              <Text variant="caption" tone="muted">General education with stricter safety rules. The AI can’t diagnose or prescribe rehab.</Text>
              <Field label="Your question" placeholder="e.g. Why do stairs feel harder than walking?" value={question} onChangeText={setQuestion} multiline />
              <Button label="Ask" icon="sparkles" size="sm" onPress={ask} loading={busy} />
              {answer ? <Text>{answer.text}</Text> : null}
              {answer?.note ? <Text variant="caption" tone="subtle">{answer.note}</Text> : null}
            </Card>
          ) : null}
          <Text variant="caption" tone="subtle">FORMA is a fitness and wellness app. It does not diagnose conditions such as meniscus or ligament injuries or arthritis, and it doesn’t replace a clinician.</Text>
        </>
      )}
    </Screen>
  );
}
