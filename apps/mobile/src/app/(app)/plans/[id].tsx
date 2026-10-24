import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { confirm } from '@/lib/confirm';
import { router, useLocalSearchParams } from 'expo-router';
import { EXERCISE_MAP, WEEKDAYS, workoutPlanSchema, type PlanDay, type PlannedExercise, type WorkoutPlan } from '@forma/shared';
import { useMutations } from '@/lib/data';
import { nowIso, newId } from '@/lib/ids';
import { useTheme } from '@/lib/theme';
import { usePlans } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, Stepper, Toggle } from '@/components/ui/Controls';
import { Banner, Loading, SectionHeader } from '@/components/ui/Feedback';
import { ExercisePicker } from '@/components/ExercisePicker';
import { MOBILITY_MAP } from '@forma/shared';



export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, loading } = usePlans();
  const { save } = useMutations();
  const { c } = useTheme();
  const original = items.find((p) => p.id === id);
  const [plan, setPlan] = useState<WorkoutPlan>();
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<{ dayKey: string; replaceKey?: string }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (original && !dirty) setPlan(original);
  }, [original, dirty]);

  if (!plan) return <Screen title="Plan" back>{loading ? <Loading /> : <Banner tone="warning">Plan not found.</Banner>}</Screen>;

  const update = (fn: (p: WorkoutPlan) => WorkoutPlan) => {
    setPlan((p) => (p ? fn(p) : p));
    setDirty(true);
  };
  const updateDay = (key: string, fn: (d: PlanDay) => PlanDay) => update((p) => ({ ...p, days: p.days.map((d) => (d.key === key ? fn(d) : d)) }));
  const updateEx = (dayKey: string, exKey: string, patch: Partial<PlannedExercise>) => updateDay(dayKey, (d) => ({ ...d, exercises: d.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) }));
  const move = (dayKey: string, index: number, dir: -1 | 1) =>
    updateDay(dayKey, (d) => {
      const list = [...d.exercises];
      const j = index + dir;
      if (j < 0 || j >= list.length) return d;
      [list[index], list[j]] = [list[j]!, list[index]!];
      return { ...d, exercises: list };
    });

  const persist = async () => {
    setError(undefined);
    // Sessions keep their own copy of exercises, so editing a plan never rewrites history.
    const next = { ...plan, version: (original?.version ?? 1) + 1, revision: (original?.revision ?? 0) + 1, updatedAt: nowIso() };
    const parsed = workoutPlanSchema.safeParse(next);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Please check the plan.');
    await save('workoutPlans', plan.id, parsed.data);
    setDirty(false);
    router.back();
  };

  return (
    <Screen title="Edit plan" back right={dirty ? <Button label="Save" size="sm" onPress={persist} /> : undefined}>
      <Field label="Plan name" value={plan.name} onChangeText={(t) => update((p) => ({ ...p, name: t }))} />
      <Toggle label="Active plan" description="Your active plan drives Today and the weekly schedule." value={plan.active} onChange={(v) => update((p) => ({ ...p, active: v }))} />
      <Stepper label="Session length (min)" value={plan.sessionMinutes} step={5} min={10} max={180} onChange={(v) => update((p) => ({ ...p, sessionMinutes: v }))} />
      <Text variant="caption" tone="subtle">Version {original?.version ?? 1}. Saving creates version {(original?.version ?? 1) + 1}; completed workouts keep what you actually did.</Text>
      {error ? <Banner tone="danger">{error}</Banner> : null}

      {plan.days.map((day) => (
        <Card key={day.key} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Field label="Day name" value={day.name} onChangeText={(t) => updateDay(day.key, (d) => ({ ...d, name: t }))} style={{ flex: 1 }} />
            <IconButton icon="trash-outline" label={`Remove ${day.name}`} tone="danger" onPress={async () => (plan.days.length > 1 && (await confirm('Remove day?', `Remove ${day.name} from this plan?`)) ? update((p) => ({ ...p, days: p.days.filter((d) => d.key !== day.key) })) : undefined)} />
          </View>
          <Text variant="caption" tone="muted">Scheduled day</Text>
          <ChipGroup
            scroll
            options={[{ value: '0', label: 'None' }, ...WEEKDAYS.map((w) => ({ value: String(w.iso), label: w.short }))]}
            value={String(day.weekday ?? 0)}
            onChange={(v) => updateDay(day.key, (d) => ({ ...d, weekday: Number(v) || undefined }))}
          />
          <Text variant="caption" tone="subtle">
            Warm-up: {MOBILITY_MAP.get(day.warmupRoutineId ?? '')?.name ?? 'none'} · Cooldown: {MOBILITY_MAP.get(day.cooldownRoutineId ?? '')?.name ?? 'none'}
          </Text>
          {day.exercises.map((e, i) => {
            const ex = EXERCISE_MAP.get(e.exerciseId);
            return (
              <View key={e.key} style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 12, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text variant="label" style={{ flex: 1 }} onPress={() => router.push(`/exercises/${e.exerciseId}`)}>{i + 1}. {ex?.name ?? e.exerciseId}</Text>
                  <IconButton icon="arrow-up" label="Move up" onPress={() => move(day.key, i, -1)} />
                  <IconButton icon="arrow-down" label="Move down" onPress={() => move(day.key, i, 1)} />
                  <IconButton icon="swap-horizontal" label="Replace exercise" onPress={() => setPicker({ dayKey: day.key, replaceKey: e.key })} />
                  <IconButton icon="close" label="Remove exercise" tone="danger" onPress={() => updateDay(day.key, (d) => ({ ...d, exercises: d.exercises.filter((x) => x.key !== e.key) }))} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: 12 }}>
                  <Stepper label="Sets" value={e.sets} min={1} max={10} onChange={(v) => updateEx(day.key, e.key, { sets: v })} />
                  {ex?.timed ? (
                    <Stepper label="Seconds" value={e.durationSec ?? 30} step={5} min={5} max={600} onChange={(v) => updateEx(day.key, e.key, { durationSec: v })} />
                  ) : (
                    <>
                      <Stepper label="Reps min" value={e.repsMin} min={1} max={e.repsMax} onChange={(v) => updateEx(day.key, e.key, { repsMin: v })} />
                      <Stepper label="Reps max" value={e.repsMax} min={e.repsMin} max={100} onChange={(v) => updateEx(day.key, e.key, { repsMax: v })} />
                    </>
                  )}
                  <Stepper label="Rest (s)" value={e.restSec} step={15} min={0} max={600} onChange={(v) => updateEx(day.key, e.key, { restSec: v })} />
                  <Stepper label="Reps in reserve" value={e.targetRir ?? 2} min={0} max={5} onChange={(v) => updateEx(day.key, e.key, { targetRir: v })} />
                </View>
              </View>
            );
          })}
          <Button label="Add exercise" icon="add" variant="secondary" onPress={() => setPicker({ dayKey: day.key })} />
        </Card>
      ))}

      <Button
        label="Add day"
        variant="ghost"
        icon="add-circle-outline"
        onPress={() => plan.days.length < 7 && update((p) => ({ ...p, days: [...p.days, { key: newId().slice(0, 10), name: `Day ${p.days.length + 1}`, exercises: [], warmupRoutineId: 'general-warmup', cooldownRoutineId: 'post-workout-cooldown' }] }))}
      />
      <SectionHeader title="Danger zone" />
      <Button
        label="Archive plan"
        variant="danger"
        onPress={async () => {
          if (!(await confirm('Archive plan?', 'Your workout history is kept. You can create a new plan any time.'))) return;
          await save('workoutPlans', plan.id, { ...plan, active: false, archivedAt: nowIso(), updatedAt: nowIso(), revision: (plan.revision ?? 0) + 1 });
          router.back();
        }}
      />

      <ExercisePicker
        visible={!!picker}
        onClose={() => setPicker(undefined)}
        suggestIds={picker?.replaceKey ? EXERCISE_MAP.get(plan.days.find((d) => d.key === picker.dayKey)?.exercises.find((e) => e.key === picker.replaceKey)?.exerciseId ?? '')?.substitutions : undefined}
        onPick={(ex) => {
          if (!picker) return;
          if (picker.replaceKey) updateEx(picker.dayKey, picker.replaceKey, { exerciseId: ex.id, durationSec: ex.timed ? 30 : undefined });
          else
            updateDay(picker.dayKey, (d) => ({
              ...d,
              exercises: [...d.exercises, { key: newId().slice(0, 12), exerciseId: ex.id, sets: 3, repsMin: 8, repsMax: 12, restSec: 90, targetRir: 2, warmupSets: 0, durationSec: ex.timed ? 30 : undefined }],
            }));
        }}
      />
    </Screen>
  );
}
