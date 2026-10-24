import { useState } from 'react';
import { EQUIPMENT, EQUIPMENT_LABELS, GOALS, GOAL_LABELS, WEEKDAYS, ACTIVITY_LABELS, DIET_PREFERENCES, cmToIn, kgToLb, round, toCm, toKg, type Profile } from '@forma/shared';
import { router } from 'expo-router';
import { useProfile } from '@/lib/profile';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ChipGroup, Field, NumberField } from '@/components/ui/Controls';

export default function EditProfile() {
  const { profile, save } = useProfile();
  const units = profile?.units ?? 'metric';
  const [p, setP] = useState<Partial<Profile>>(profile ?? {});
  const [height, setHeight] = useState(profile?.heightCm ? (units === 'imperial' ? round(cmToIn(profile.heightCm), 1) : profile.heightCm) : undefined);
  const [weight, setWeight] = useState(profile?.weightKg ? (units === 'imperial' ? round(kgToLb(profile.weightKg), 1) : profile.weightKg) : undefined);
  const [msg, setMsg] = useState<string>();
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const persist = async () => {
    if (!p.displayName?.trim()) return setMsg('Name can’t be empty.');
    if (p.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) return setMsg('Date of birth should look like 1995-06-30.');
    await save({ ...p, primaryGoal: p.goals?.[0], heightCm: height ? round(toCm(height, units), 1) : undefined, weightKg: weight ? round(toKg(weight, units), 1) : undefined });
    router.back();
  };
  return (
    <Screen title="Profile & goals" back right={<Button label="Save" size="sm" onPress={persist} />}>
      <Card style={{ gap: 10 }}>
        <Field label="Preferred name" value={p.displayName ?? ''} onChangeText={(t) => set({ displayName: t })} />
        <Field label="Pronouns (optional)" value={p.pronouns ?? ''} onChangeText={(t) => set({ pronouns: t || undefined })} />
        <Field label="Date of birth (optional)" placeholder="YYYY-MM-DD" value={p.birthDate ?? ''} onChangeText={(t) => set({ birthDate: t || undefined })} />
        <NumberField label="Height" unit={units === 'imperial' ? 'in' : 'cm'} value={height} onChange={setHeight} decimals={1} />
        <NumberField label="Weight" unit={units === 'imperial' ? 'lb' : 'kg'} value={weight} onChange={setWeight} decimals={1} />
        <Text variant="label">Sex for energy estimates (optional)</Text>
        <Text variant="caption" tone="muted">Only used in the calorie equation. Never used for goals or plans.</Text>
        <ChipGroup options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'prefer_not', label: 'Prefer not to say' }]} value={p.calcSex ?? 'prefer_not'} onChange={(v) => set({ calcSex: v as Profile['calcSex'] })} />
      </Card>
      <Card style={{ gap: 10 }}>
        <Text variant="label">Goals (first = main focus)</Text>
        <ChipGroup multi options={GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))} value={p.goals ?? []} onChange={(v) => set({ goals: (v as Profile['goals']).slice(0, 4) })} />
        <Text variant="label">Experience</Text>
        <ChipGroup options={['new', 'beginner', 'intermediate', 'advanced'].map((v) => ({ value: v, label: v }))} value={p.experience ?? 'beginner'} onChange={(v) => set({ experience: v as Profile['experience'] })} />
        <Text variant="label">Equipment</Text>
        <ChipGroup multi options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))} value={p.equipment ?? []} onChange={(v) => set({ equipment: v as Profile['equipment'] })} />
        <Text variant="label">Training days</Text>
        <ChipGroup multi options={WEEKDAYS.map((d) => ({ value: String(d.iso), label: d.short }))} value={(p.trainingDays ?? []).map(String)} onChange={(v) => set({ trainingDays: (v as string[]).map(Number).sort() })} />
        <Text variant="label">Session length</Text>
        <ChipGroup options={['20', '30', '45', '60', '75', '90'].map((m) => ({ value: m, label: `${m} min` }))} value={String(p.sessionMinutes ?? 45)} onChange={(v) => set({ sessionMinutes: Number(v) })} />
      </Card>
      <Card style={{ gap: 10 }}>
        <Text variant="label">Diet</Text>
        <ChipGroup options={DIET_PREFERENCES.map((d) => ({ value: d, label: d.replace('_', ' ') }))} value={p.dietPreference ?? 'none'} onChange={(v) => set({ dietPreference: v as Profile['dietPreference'] })} />
        <Field label="Allergies" value={(p.allergies ?? []).join(', ')} onChangeText={(t) => set({ allergies: t.split(',').map((s) => s.trim()).filter(Boolean) })} />
        <Text variant="label">Everyday activity</Text>
        <ChipGroup options={Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }))} value={p.activityLevel ?? 'light'} onChange={(v) => set({ activityLevel: v as Profile['activityLevel'] })} />
        <Text variant="label">Sleep goal</Text>
        <ChipGroup options={['6', '7', '8', '9', '10'].map((h) => ({ value: h, label: `${h} h` }))} value={String(p.sleepTargetHours ?? 8)} onChange={(v) => set({ sleepTargetHours: Number(v) })} />
      </Card>
      {msg ? <Text variant="caption" tone="danger">{msg}</Text> : null}
      <Button label="Save changes" onPress={persist} />
    </Screen>
  );
}
