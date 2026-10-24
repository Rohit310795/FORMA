import { useState } from 'react';
import { router } from 'expo-router';
import { EXERCISES, JOINTS, JOINT_LABEL, clinicianInstructionSchema, type ClinicianInstruction, type Joint } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { newId, nowIso } from '@/lib/ids';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, Toggle, ListRow } from '@/components/ui/Controls';
import { Banner, EmptyState } from '@/components/ui/Feedback';
import { confirm } from '@/lib/confirm';

export default function Clinician() {
  const { profile, save: saveProfile } = useProfile();
  const { items } = useCollection<ClinicianInstruction>('clinicianInstructions');
  const { save, remove } = useMutations();
  const [text, setText] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [joint, setJoint] = useState<Joint | 'none'>('none');
  const [avoid, setAvoid] = useState<string[]>([]);
  const [avoidImpact, setAvoidImpact] = useState(false);
  const [avoidDeep, setAvoidDeep] = useState(false);
  const [error, setError] = useState<string>();

  if (!profile?.consent?.healthDetails) {
    return (
      <Screen title="Clinician instructions" back>
        <Banner tone="info" title="Consent needed">Clinician instructions are health details. FORMA only stores them if you allow it.</Banner>
        <Button label="Allow storing health details" onPress={() => saveProfile({ consent: { ...profile!.consent, healthDetails: true } })} />
      </Screen>
    );
  }

  const add = async () => {
    setError(undefined);
    const id = newId();
    const parsed = clinicianInstructionSchema.safeParse({
      id, instructions: text, givenBy: givenBy || undefined, joint: joint === 'none' ? undefined : joint, avoidExerciseIds: avoid,
      avoidTags: [...(avoidImpact ? ['impact', 'plyometric'] : []), ...(avoidDeep ? ['deep_knee_flexion'] : [])], active: true,
      createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual',
    });
    if (!parsed.success) return setError('Please add the instructions you were given.');
    await save('clinicianInstructions', id, parsed.data);
    setText('');
    setAvoid([]);
  };

  return (
    <Screen title="Clinician instructions" subtitle="Your doctor’s or physio’s advice always comes first" back>
      <Banner tone="info">Anything you add here overrides FORMA’s suggestions. Excluded exercises are removed from plans, swaps and AI drafts.</Banner>
      <Card style={{ gap: 10 }}>
        <Field label="Instructions you were given" placeholder="e.g. No running or jumping for 6 weeks; squats only to a chair" value={text} onChangeText={setText} multiline />
        <Field label="From (optional)" placeholder="e.g. Dr Rao, physiotherapist" value={givenBy} onChangeText={setGivenBy} />
        <Text variant="label">Related area</Text>
        <ChipGroup scroll options={[{ value: 'none', label: 'General' }, ...JOINTS.map((j) => ({ value: j, label: JOINT_LABEL[j] }))]} value={joint} onChange={(v) => setJoint(v as Joint | 'none')} />
        <Toggle label="Avoid running, jumping and impact" value={avoidImpact} onChange={setAvoidImpact} />
        <Toggle label="Avoid deep knee bending" value={avoidDeep} onChange={setAvoidDeep} />
        <Text variant="label">Specific exercises to avoid</Text>
        <ChipGroup scroll multi options={EXERCISES.filter((e) => e.type !== 'mobility').map((e) => ({ value: e.id, label: e.name }))} value={avoid} onChange={(v) => setAvoid(v as string[])} />
        {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
        <Button label="Save instructions" onPress={add} />
      </Card>
      {items.length ? items.map((i) => (
        <Card key={i.id}>
          <ListRow
            icon="document-text-outline"
            title={i.instructions}
            subtitle={[i.givenBy, i.joint ? JOINT_LABEL[i.joint] : null, i.avoidExerciseIds.length ? `${i.avoidExerciseIds.length} exercises excluded` : null, i.avoidTags.length ? `avoid ${i.avoidTags.join(', ').replace(/_/g, ' ')}` : null, i.active ? 'active' : 'inactive'].filter(Boolean).join(' · ')}
            right={<IconButton icon="trash-outline" label="Delete" tone="danger" onPress={async () => (await confirm('Delete instructions?', 'They will no longer be applied.', 'Delete')) && remove('clinicianInstructions', i.id)} />}
          />
          <Toggle label="Apply these instructions" value={i.active} onChange={(v) => save('clinicianInstructions', i.id, { ...i, active: v, updatedAt: nowIso(), revision: (i.revision ?? 0) + 1 })} />
        </Card>
      )) : <EmptyState icon="document-text-outline" title="Nothing added yet" message="If a clinician has given you exercise guidance, add it here so FORMA respects it." />}
      <Button label="Knee health" variant="ghost" onPress={() => router.push('/recovery/knee')} />
    </Screen>
  );
}
