import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  AI_CONTEXT_CATEGORIES,
  AI_CONTEXT_LABELS,
  ACTIVITY_LABELS,
  DIET_PREFERENCES,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  GOALS,
  GOAL_LABELS,
  WEEKDAYS,
  ageFromBirthDate,
  dayKey,
  goalToEnergyGoal,
  macroTargets,
  suggestedWaterMl,
  toCm,
  toKg,
  type AiContextCategory,
  type Profile,
} from '@forma/shared';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { useMutations } from '@/lib/data';
import { useConfig } from '@/lib/config';
import { nowIso } from '@/lib/ids';
import { useTheme } from '@/lib/theme';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipGroup, Field, NumberField, Segmented, Toggle } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';

type Step = 'goals' | 'about' | 'training' | 'lifestyle' | 'privacy';
const STEPS: Step[] = ['goals', 'about', 'training', 'lifestyle', 'privacy'];

const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase());

export default function Onboarding() {
  const { user } = useAuth();
  const { save } = useProfile();
  const { save: saveDoc } = useMutations();
  const { config } = useConfig();
  const { c } = useTheme();
  const [step, setStep] = useState<Step>('goals');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [units, setUnits] = useState<'metric' | 'imperial'>(config?.settings.defaultUnits ?? 'metric');
  const [heightInput, setHeightInput] = useState<number>();
  const [weightInput, setWeightInput] = useState<number>();
  const [p, setP] = useState<Partial<Profile>>({
    displayName: user?.displayName ?? '',
    goals: [],
    equipment: ['bodyweight'],
    trainingLocation: 'mixed',
    trainingDays: [],
    sessionMinutes: config?.settings.onboardingDefaults?.sessionMinutes ?? 45,
    experience: 'beginner',
    dietPreference: 'none',
    allergies: [],
    activityLevel: 'light',
    sleepTargetHours: 8,
    theme: 'dark',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [consent, setConsent] = useState({ healthDetails: false, lifeStageContent: false, analytics: false, aiContext: [] as AiContextCategory[] });
  const idx = STEPS.indexOf(step);
  const set = (patch: Partial<Profile>) => setP((x) => ({ ...x, ...patch }));
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]!);

  const birthValid = useMemo(() => !p.birthDate || /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate), [p.birthDate]);

  const finish = async () => {
    setError(undefined);
    if (!p.displayName?.trim()) return setError('Please add a name (it can be a nickname).');
    if (!birthValid) return setError('Date of birth should look like 1995-06-30.');
    setBusy(true);
    try {
      const heightCm = heightInput ? Math.round(toCm(heightInput, units)) : undefined;
      const weightKg = weightInput ? Math.round(toKg(weightInput, units) * 10) / 10 : undefined;
      const now = nowIso();
      const profile: Partial<Profile> = {
        ...p,
        displayName: p.displayName!.trim(),
        units,
        heightCm,
        weightKg,
        primaryGoal: p.goals?.[0],
        consent: { ...consent, termsAcceptedAt: now, privacyAcceptedAt: now },
        onboardingCompletedAt: now,
      };
      const today = dayKey(new Date(), p.timeZone);
      if (heightCm && weightKg && p.birthDate) {
        const t = macroTargets(
          { weightKg, heightCm, age: ageFromBirthDate(p.birthDate, today), calcSex: p.calcSex ?? 'prefer_not', activity: p.activityLevel ?? 'light' },
          goalToEnergyGoal(p.goals?.[0]),
        );
        await saveDoc('settings', 'nutritionTargets', { kcal: t.kcal, proteinG: t.proteinG, carbsG: t.carbsG, fatG: t.fatG, waterMl: suggestedWaterMl(weightKg, p.activityLevel), mode: 'calculated', updatedAt: now });
      } else {
        await saveDoc('settings', 'nutritionTargets', { kcal: 2000, proteinG: 100, carbsG: 230, fatG: 65, waterMl: suggestedWaterMl(weightKg, p.activityLevel), mode: 'custom', updatedAt: now });
      }
      if (weightKg) {
        const id = `w${today.replace(/-/g, '')}`;
        await saveDoc('bodyMeasurements', id, { id, dayKey: today, weightKg, sites: {}, createdAt: now, updatedAt: now, revision: 0, source: 'manual' });
      }
      await save(profile);
    } catch (e) {
      setError((e as Error).message || 'Couldn’t save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
      {idx > 0 ? <Button label="Back" variant="secondary" onPress={() => setStep(STEPS[idx - 1]!)} style={{ flex: 1 }} /> : null}
      {step !== 'privacy' && step !== 'goals' ? <Button label="Skip" variant="ghost" onPress={next} style={{ flex: 1 }} /> : null}
      {step === 'privacy' ? (
        <Button label="Finish" testID="onboarding-finish" onPress={finish} loading={busy} style={{ flex: 2 }} />
      ) : (
        <Button label="Next" testID="onboarding-next" onPress={next} style={{ flex: 2 }} />
      )}
    </View>
  );

  return (
    <Screen title={['What’s your goal?', 'Tell us about you', 'How you train', 'Food & lifestyle', 'Privacy & AI'][idx]} subtitle={`Step ${idx + 1} of ${STEPS.length}`} footer={footer}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= idx ? c.primary : c.surfaceRaised }} />
        ))}
      </View>

      {step === 'goals' && (
        <>
          <Field label="Preferred name" testID="onboarding-name" value={p.displayName} onChangeText={(t) => set({ displayName: t })} />
          <Text tone="muted">Pick up to four. Your first pick becomes your main focus — you can change this any time.</Text>
          <ChipGroup
            multi
            options={GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))}
            value={p.goals ?? []}
            onChange={(v) => set({ goals: (v as Profile['goals']).slice(0, 4) })}
          />
        </>
      )}

      {step === 'about' && (
        <>
          <Segmented options={[{ value: 'metric', label: 'Metric (kg, cm)' }, { value: 'imperial', label: 'Imperial (lb, in)' }]} value={units} onChange={setUnits} />
          <Field label="Date of birth (optional)" placeholder="YYYY-MM-DD" value={p.birthDate ?? ''} onChangeText={(t) => set({ birthDate: t || undefined })} error={birthValid ? undefined : 'Use the format YYYY-MM-DD'} hint="Used to estimate energy needs. Never shown to others." />
          <NumberField label="Height" unit={units === 'metric' ? 'cm' : 'in'} value={heightInput} onChange={setHeightInput} decimals={1} />
          <NumberField label="Current weight" unit={units === 'metric' ? 'kg' : 'lb'} value={weightInput} onChange={setWeightInput} decimals={1} />
          <Card>
            <Text variant="label">Sex for energy estimates (optional)</Text>
            <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>
              Only used in the calorie-estimate equation, which differs slightly by sex. It never changes your goals, plans or what FORMA thinks you can do. Choose “Prefer not to say” and we’ll use a midpoint.
            </Text>
            <ChipGroup options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'prefer_not', label: 'Prefer not to say' }]} value={p.calcSex ?? 'prefer_not'} onChange={(v) => set({ calcSex: v as Profile['calcSex'] })} />
          </Card>
          <Field label="Pronouns (optional)" placeholder="e.g. she/her, he/him, they/them" value={p.pronouns ?? ''} onChangeText={(t) => set({ pronouns: t || undefined })} />
        </>
      )}

      {step === 'training' && (
        <>
          <Text variant="label">Experience</Text>
          <ChipGroup options={[{ value: 'new', label: 'Brand new' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} value={p.experience ?? 'beginner'} onChange={(v) => set({ experience: v as Profile['experience'] })} />
          <Text variant="label">Where do you train?</Text>
          <ChipGroup options={[{ value: 'gym', label: 'Gym' }, { value: 'home', label: 'Home' }, { value: 'outdoors', label: 'Outdoors' }, { value: 'mixed', label: 'Mixed' }]} value={p.trainingLocation ?? 'mixed'} onChange={(v) => set({ trainingLocation: v as Profile['trainingLocation'] })} />
          <Text variant="label">Equipment you can use</Text>
          <ChipGroup multi options={EQUIPMENT.map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }))} value={p.equipment ?? []} onChange={(v) => set({ equipment: v as Profile['equipment'] })} />
          <Text variant="label">Preferred training days</Text>
          <ChipGroup multi options={WEEKDAYS.map((d) => ({ value: String(d.iso), label: d.short }))} value={(p.trainingDays ?? []).map(String)} onChange={(v) => set({ trainingDays: (v as string[]).map(Number).sort() })} />
          <Text variant="label">Session length</Text>
          <ChipGroup options={['20', '30', '45', '60', '75'].map((m) => ({ value: m, label: `${m} min` }))} value={String(p.sessionMinutes ?? 45)} onChange={(v) => set({ sessionMinutes: Number(v) })} />
        </>
      )}

      {step === 'lifestyle' && (
        <>
          <Text variant="label">Dietary preference</Text>
          <ChipGroup options={DIET_PREFERENCES.map((d) => ({ value: d, label: label(d) }))} value={p.dietPreference ?? 'none'} onChange={(v) => set({ dietPreference: v as Profile['dietPreference'] })} />
          <Field label="Allergies or foods to avoid (optional)" placeholder="e.g. peanuts, shellfish" value={(p.allergies ?? []).join(', ')} onChangeText={(t) => set({ allergies: t.split(',').map((s) => s.trim()).filter(Boolean) })} />
          <Text variant="label">Everyday activity</Text>
          <ChipGroup options={Object.entries(ACTIVITY_LABELS).map(([value, l]) => ({ value, label: l }))} value={p.activityLevel ?? 'light'} onChange={(v) => set({ activityLevel: v as Profile['activityLevel'] })} />
          <Text variant="label">Sleep goal</Text>
          <ChipGroup options={['6', '7', '8', '9'].map((h) => ({ value: h, label: `${h} h` }))} value={String(p.sleepTargetHours ?? 8)} onChange={(v) => set({ sleepTargetHours: Number(v) })} />
        </>
      )}

      {step === 'privacy' && (
        <>
          <Banner tone="info" title="You’re in control">Everything below is off unless you turn it on, and you can change it any time in Settings → Privacy.</Banner>
          <Card>
            <Text variant="label">What the AI Coach may use</Text>
            <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>
              Only the categories you allow are summarised and sent with a request — never everything by default. AI requests are processed by the AI provider configured by FORMA’s operator.
            </Text>
            <ChipGroup
              multi
              options={AI_CONTEXT_CATEGORIES.filter((k) => k !== 'discomfort').map((k) => ({ value: k, label: AI_CONTEXT_LABELS[k] }))}
              value={consent.aiContext}
              onChange={(v) => setConsent((x) => ({ ...x, aiContext: v as AiContextCategory[] }))}
            />
          </Card>
          <Toggle
            testID="consent-health"
            label="Store discomfort logs and clinician notes"
            description="Needed for the Knee Health discomfort log. Kept private to your account. You can delete them at any time."
            value={consent.healthDetails}
            onChange={(v) => setConsent((x) => ({ ...x, healthDetails: v, aiContext: v ? x.aiContext : x.aiContext.filter((k) => k !== 'discomfort') }))}
          />
          {consent.healthDetails ? (
            <Toggle
              label="Let the AI Coach see discomfort summaries"
              description="Helps it suggest comfortable alternatives. It still cannot diagnose."
              value={consent.aiContext.includes('discomfort')}
              onChange={(v) => setConsent((x) => ({ ...x, aiContext: v ? [...x.aiContext, 'discomfort'] : x.aiContext.filter((k) => k !== 'discomfort') }))}
            />
          ) : null}
          <Toggle label="Cycle, pregnancy, postpartum & menopause content" description="Optional, consent-based content in Glow. Off by default." value={consent.lifeStageContent} onChange={(v) => setConsent((x) => ({ ...x, lifeStageContent: v }))} />
          <Toggle label="Share anonymous usage analytics" description="Helps improve FORMA. Never includes health details." value={consent.analytics} onChange={(v) => setConsent((x) => ({ ...x, analytics: v }))} />
          <Text variant="caption" tone="subtle">FORMA offers fitness and wellness guidance. It does not diagnose, treat or replace care from a qualified professional.</Text>
          {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
        </>
      )}
    </Screen>
  );
}
