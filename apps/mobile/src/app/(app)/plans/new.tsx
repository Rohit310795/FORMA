import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { EXERCISES, SPLIT_TEMPLATES, buildPlanFromTemplate, filterExercises, type ClinicianInstruction, type DiscomfortLog, type WorkoutPlan } from '@forma/shared';
import { useProfile } from '@/lib/profile';
import { useCollection, useMutations, useUserDoc } from '@/lib/data';
import { useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { newId, nowIso } from '@/lib/ids';
import { useActivePlan, useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Banner, SectionHeader } from '@/components/ui/Feedback';

export default function NewPlan() {
  const { profile } = useProfile();
  const today = useToday();
  const { plans } = useActivePlan();
  const { items: discomfort } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 20 });
  const { items: clinician } = useCollection<ClinicianInstruction>('clinicianInstructions');
  const { data: musclePrefs } = useUserDoc<{ priorities: Record<string, 'priority' | 'maintain' | 'reduce'> }>('settings', 'musclePriorities');
  const { save } = useMutations();
  const aiDraft = useFeature('workoutGeneration');
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'info' | 'warning'; text: string }>();

  const filter = filterExercises(EXERCISES, { today, discomfortLogs: discomfort, clinicianInstructions: clinician, avoidedExerciseIds: profile?.avoidedExerciseIds });

  // Muscle priorities from My Muscles: favour exercises that hit "priority" muscles
  // and don't primarily target "reduce" muscles. Never overrides safety filtering.
  const priorities = musclePrefs?.priorities ?? {};
  const priorityExerciseIds = filter.allowed
    .filter((e) => e.primaryMuscles.some((m) => priorities[m] === 'priority') && !e.primaryMuscles.some((m) => priorities[m] === 'reduce'))
    .map((e) => e.id);

  const activate = async (plan: WorkoutPlan) => {
    // Only one active plan; older ones are kept (never deleted) so history stays linked.
    for (const p of plans.filter((x) => x.active)) await save('workoutPlans', p.id, { ...p, active: false, updatedAt: nowIso(), revision: (p.revision ?? 0) + 1 });
    await save('workoutPlans', plan.id, { ...plan, active: true });
    router.replace(`/plans/${plan.id}`);
  };

  const fromTemplate = async (split: WorkoutPlan['split']) => {
    setBusy(split);
    const plan = buildPlanFromTemplate({
      split,
      equipment: profile?.equipment ?? ['bodyweight'],
      experience: profile?.experience ?? 'beginner',
      sessionMinutes: profile?.sessionMinutes ?? 45,
      trainingDays: profile?.trainingDays,
      allowed: filter.allowed,
      preferredExerciseIds: [...(profile?.preferredExerciseIds ?? []), ...priorityExerciseIds],
      now: nowIso(),
      id: newId(),
    });
    await activate(plan);
    setBusy(undefined);
  };

  const fromAi = async () => {
    setBusy('ai');
    setMessage(undefined);
    try {
      const res = await api.aiGenerateWorkout({ request });
      if (res.plan) {
        setMessage({ tone: res.source === 'ai' ? 'info' : 'warning', text: res.message });
        await activate({ ...res.plan, id: newId() });
      } else setMessage({ tone: 'warning', text: res.message });
    } catch (e) {
      setMessage({ tone: 'warning', text: apiErrorMessage(e) });
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Screen title="New plan" back>
      {filter.excluded.length ? (
        <Banner tone="info" title="Personalised for safety">
          {`${filter.excluded.length} exercises are left out because of your avoid list, clinician instructions or recent discomfort.`}
        </Banner>
      ) : null}
      {aiDraft.enabled ? (
        <Card variant="hero">
          <Text variant="heading">Draft with AI</Text>
          <Text variant="caption" tone="muted" style={{ marginVertical: 8 }}>
            Describe what you want. The draft uses only exercises that pass your safety filters, and you can edit everything before training.
          </Text>
          <Field label="What would you like?" placeholder="e.g. 3 days, dumbbells at home, focus on glutes and back" value={request} onChangeText={setRequest} multiline />
          <Button label="Draft my plan" icon="sparkles" onPress={fromAi} loading={busy === 'ai'} style={{ marginTop: 12 }} />
        </Card>
      ) : (
        <Banner tone="info">{aiDraft.message}</Banner>
      )}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      <SectionHeader title="Start from a template" />
      {SPLIT_TEMPLATES.map((t) => (
        <Card key={t.split}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{t.name}</Text>
              <Text variant="caption" tone="muted">{t.description}</Text>
              <Text variant="caption" tone="subtle">{t.days.map((d) => d.name).join(' · ')}</Text>
            </View>
            <Button label="Use" size="sm" testID={`template-${t.split}`} onPress={() => fromTemplate(t.split)} loading={busy === t.split} />
          </View>
        </Card>
      ))}
      <Card>
        <Text variant="label">Custom split</Text>
        <Text variant="caption" tone="muted" style={{ marginBottom: 8 }}>Start with an empty day and add exercises yourself.</Text>
        <Button
          label="Create custom plan"
          variant="secondary"
          onPress={() =>
            activate({
              id: newId(), name: 'My custom plan', split: 'custom', sessionMinutes: profile?.sessionMinutes ?? 45, equipment: profile?.equipment ?? [],
              days: [{ key: 'day0', name: 'Day 1', exercises: [] }], active: true, version: 1, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual',
            })
          }
        />
      </Card>
    </Screen>
  );
}
