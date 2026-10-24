import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { JOINTS, JOINT_LABEL, assessDiscomfort, discomfortLogSchema, type DiscomfortAssessment, type DiscomfortLog, type Joint } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { newId, nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChipGroup, Field, NumberField, Segmented, Stepper, Toggle } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';
import { SafetyCard } from '@/components/SafetyCard';

const opts = <T extends string>(values: readonly T[], label = (v: T) => v.replace(/_/g, ' ')) => values.map((v) => ({ value: v, label: label(v)[0]!.toUpperCase() + label(v).slice(1) }));

export default function DiscomfortLogScreen() {
  const params = useLocalSearchParams<{ joint?: string }>();
  const today = useToday();
  const { profile, save: saveProfile } = useProfile();
  const { items } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 1 });
  const { save } = useMutations();
  const [d, setD] = useState<Partial<DiscomfortLog>>({
    joint: (JOINTS as readonly string[]).includes(params.joint ?? '') ? (params.joint as Joint) : 'knee',
    side: 'left', location: 'unsure', severity: 3, onset: 'unsure', aggravators: [], sharpPain: false, stiffness: false, swelling: 'none',
    locking: false, instability: 'none', recentInjury: false, canBearWeight: true, hotOrRed: false, feverOrUnwell: false, numbnessOrTingling: false,
    trend: items.length ? 'same' : 'first_entry', impact: {},
  });
  const [result, setResult] = useState<DiscomfortAssessment>();
  const [error, setError] = useState<string>();
  const set = (patch: Partial<DiscomfortLog>) => setD((x) => ({ ...x, ...patch }));
  const consent = profile?.consent?.healthDetails;

  const submit = async () => {
    setError(undefined);
    const id = newId();
    const parsed = discomfortLogSchema.safeParse({ ...d, id, dayKey: today, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
    await save('discomfortLogs', id, parsed.data);
    setResult(assessDiscomfort(parsed.data));
  };

  if (!consent) {
    return (
      <Screen title="Log discomfort" back>
        <Banner tone="info" title="Your consent is needed">Discomfort details are sensitive. FORMA only stores them if you turn this on. They stay private to your account and you can delete them at any time.</Banner>
        <Button label="Turn on health-detail storage" onPress={() => saveProfile({ consent: { ...profile!.consent, healthDetails: true } })} />
        <Button label="Not now" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen title="Thanks for logging" back>
        <SafetyCard assessment={result} />
        {result.avoidTags.length ? (
          <Card>
            <Text variant="label">What FORMA will adjust</Text>
            <Text variant="caption" tone="muted">For the next 7 days, plans and swaps will set aside: {result.avoidTags.map((t) => t.replace(/_/g, ' ')).join(', ')}.</Text>
          </Card>
        ) : null}
        <Button label="See knee-friendly options" onPress={() => router.replace(d.joint === 'knee' ? '/recovery/knee' : `/recovery/joints?joint=${d.joint}`)} />
        <Button label="Done" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen title="Log discomfort" subtitle="Supportive tracking, not diagnosis" back>
      <Card style={{ gap: 12 }}>
        <Text variant="label">Where?</Text>
        <ChipGroup scroll options={JOINTS.map((j) => ({ value: j, label: JOINT_LABEL[j][0]!.toUpperCase() + JOINT_LABEL[j].slice(1) }))} value={d.joint!} onChange={(v) => set({ joint: v as Joint })} />
        <Segmented options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'both', label: 'Both' }, { value: 'na', label: 'N/A' }]} value={d.side!} onChange={(v) => set({ side: v })} />
        <Text variant="label">Which part?</Text>
        <ChipGroup options={opts(['front', 'back', 'inside', 'outside', 'unsure'] as const)} value={d.location!} onChange={(v) => set({ location: v as DiscomfortLog['location'] })} />
        <Stepper label="How strong is it right now? (0–10)" value={d.severity!} min={0} max={10} onChange={(v) => set({ severity: v })} />
        <Text variant="label">How did it start?</Text>
        <ChipGroup options={opts(['sudden_injury', 'gradual', 'after_activity', 'unsure'] as const)} value={d.onset!} onChange={(v) => set({ onset: v as DiscomfortLog['onset'], recentInjury: v === 'sudden_injury' })} />
        <NumberField label="How many days has it been going on?" value={d.durationDays} onChange={(v) => set({ durationDays: v })} />
        <Text variant="label">Compared with last time</Text>
        <ChipGroup options={opts(['first_entry', 'better', 'same', 'worse', 'rapidly_worse'] as const, (v) => (v === 'first_entry' ? 'first time' : v.replace('_', ' ')))} value={d.trend!} onChange={(v) => set({ trend: v as DiscomfortLog['trend'] })} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text variant="label">What makes it worse?</Text>
        <ChipGroup multi options={opts(['stairs', 'squatting', 'kneeling', 'running', 'jumping', 'sitting_long', 'walking', 'lifting', 'overhead', 'other'] as const)} value={d.aggravators ?? []} onChange={(v) => set({ aggravators: v as DiscomfortLog['aggravators'] })} />
        <Toggle label="Sharp or stabbing pain" value={!!d.sharpPain} onChange={(v) => set({ sharpPain: v })} />
        <Toggle label="Stiffness" value={!!d.stiffness} onChange={(v) => set({ stiffness: v })} />
        <Text variant="label">Swelling</Text>
        <Segmented options={[{ value: 'none', label: 'None' }, { value: 'mild', label: 'Mild' }, { value: 'significant', label: 'Significant' }]} value={d.swelling!} onChange={(v) => set({ swelling: v })} />
        <Toggle label="Locking or catching" description="The joint gets stuck or won’t straighten" value={!!d.locking} onChange={(v) => set({ locking: v })} />
        <Text variant="label">Giving way / instability</Text>
        <Segmented options={[{ value: 'none', label: 'None' }, { value: 'occasional', label: 'Occasional' }, { value: 'substantial', label: 'Substantial' }]} value={d.instability!} onChange={(v) => set({ instability: v })} />
        <Toggle label="I can put weight on it" value={d.canBearWeight !== false} onChange={(v) => set({ canBearWeight: v })} />
        <Toggle label="It looks hot or red" value={!!d.hotOrRed} onChange={(v) => set({ hotOrRed: v })} />
        <Toggle label="I have a fever or feel unwell" value={!!d.feverOrUnwell} onChange={(v) => set({ feverOrUnwell: v })} />
        <Toggle label="Numbness or tingling" value={!!d.numbnessOrTingling} onChange={(v) => set({ numbnessOrTingling: v })} />
      </Card>
      <Card style={{ gap: 12 }}>
        <Text variant="label">Effect on daily life (0 none – 3 a lot)</Text>
        {(['walking', 'stairs', 'exercise'] as const).map((k) => (
          <Stepper key={k} label={k[0]!.toUpperCase() + k.slice(1)} value={d.impact?.[k] ?? 0} min={0} max={3} onChange={(v) => set({ impact: { ...d.impact, [k]: v } })} />
        ))}
        <Field label="What have you tried? (optional)" value={d.triedSoFar ?? ''} onChangeText={(t) => set({ triedSoFar: t || undefined })} />
        <Field label="Notes (optional)" value={d.note ?? ''} onChangeText={(t) => set({ note: t || undefined })} multiline />
      </Card>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button label="Save log" testID="save-discomfort" onPress={submit} />
      <Text variant="caption" tone="subtle">If symptoms are severe or rapidly worsening, please seek professional care. In an emergency, contact your local emergency number.</Text>
    </Screen>
  );
}
