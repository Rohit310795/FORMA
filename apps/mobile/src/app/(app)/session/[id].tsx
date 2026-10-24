import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXERCISE_MAP, kgToLb, lbToKg, previousPerformance, suggestNextLoad, round, type LoggedSet, type WorkoutSession } from '@forma/shared';
import { useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { confirm } from '@/lib/confirm';
import { nowIso } from '@/lib/ids';
import { useSessions, useActivePlan } from '@/features/hooks';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, Stepper, Toggle } from '@/components/ui/Controls';
import { Banner, Loading } from '@/components/ui/Feedback';
import { ExercisePicker } from '@/components/ExercisePicker';
import { MUSCLE_LABELS } from '@/components/BodyMap';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
};

export default function LiveSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, loading } = useSessions();
  const { plan } = useActivePlan();
  const { profile } = useProfile();
  const { save } = useMutations();
  const { c } = useTheme();
  const units = profile?.units ?? 'metric';
  const stored = items.find((s) => s.id === id);
  const [session, setSession] = useState<WorkoutSession>();
  const [index, setIndex] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number>();
  const [now, setNow] = useState(Date.now());
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [discomfortOpen, setDiscomfortOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (stored && !session) setSession(stored);
  }, [stored, session]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (restEndsAt && now >= restEndsAt) {
      setRestEndsAt(undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [now, restEndsAt]);

  // Every change is persisted locally and queued for sync (debounced).
  const commit = useCallback(
    (next: WorkoutSession, immediate = false) => {
      const stamped = { ...next, updatedAt: nowIso(), revision: (next.revision ?? 0) + 1 };
      setSession(stamped);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = () => void save('workoutSessions', stamped.id, stamped);
      if (immediate) run();
      else saveTimer.current = setTimeout(run, 700);
      return stamped;
    },
    [save],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  const finished = session?.status === 'completed';
  useEffect(() => {
    if (finished && session) router.replace(`/session/summary/${session.id}`);
  }, [finished, session]);

  const history = useMemo(() => items.filter((s) => s.id !== id), [items, id]);

  if (!session) return <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>{loading ? <Loading label="Loading workout…" /> : <Banner tone="warning">Workout not found.</Banner>}</SafeAreaView>;
  if (finished) return null;
  if (session.status === 'abandoned') return <SafeAreaView style={{ flex: 1, backgroundColor: c.background, padding: 16 }}><Banner tone="info">This workout was discarded.</Banner></SafeAreaView>;

  const ex = session.exercises[index];
  const def = ex ? EXERCISE_MAP.get(ex.exerciseId) : undefined;
  const plannedDay = plan?.days.find((d) => d.key === session.planDayKey);
  const planned = plannedDay?.exercises.find((p) => p.key === ex?.key);
  const prev = ex ? previousPerformance(history, ex.exerciseId) : undefined;
  const suggestion = prev && planned ? suggestNextLoad(prev.sets, planned.repsMax) : undefined;
  const paused = session.status === 'paused';
  const elapsed = (paused && session.pausedAt ? Date.parse(session.pausedAt) : now) - Date.parse(session.startedAt) - (session.pausedMs ?? 0);
  const step = units === 'imperial' ? 5 : 2.5;
  const toDisplay = (kg?: number) => (kg === undefined ? 0 : units === 'imperial' ? round(kgToLb(kg), 0) : kg);
  const fromDisplay = (v: number) => (units === 'imperial' ? round(lbToKg(v), 2) : v);

  const updateSet = (si: number, patch: Partial<LoggedSet>) => {
    if (!ex) return;
    commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e)) });
  };
  const toggleComplete = (si: number) => {
    const set = ex?.sets[si];
    if (!set || !ex) return;
    const done = !set.completed;
    updateSet(si, { completed: done, completedAt: done ? nowIso() : undefined });
    if (done) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (ex.restSec > 0) setRestEndsAt(Date.now() + ex.restSec * 1000);
    }
  };
  const addSet = () => {
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, sets: [...e.sets, { kind: 'working', reps: last?.reps, weightKg: last?.weightKg, durationSec: last?.durationSec, completed: false }] } : e)) });
  };
  const removeSet = (si: number) => ex && commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, sets: e.sets.filter((_, j) => j !== si) } : e)) });

  const togglePause = () => {
    if (paused) commit({ ...session, status: 'in_progress', pausedMs: (session.pausedMs ?? 0) + (Date.now() - Date.parse(session.pausedAt ?? nowIso())), pausedAt: undefined }, true);
    else commit({ ...session, status: 'paused', pausedAt: nowIso() }, true);
  };

  const finish = (effort: number | undefined, note: string) => {
    const pausedExtra = paused && session.pausedAt ? Date.now() - Date.parse(session.pausedAt) : 0;
    const done = commit({ ...session, status: 'completed', endedAt: nowIso(), pausedAt: undefined, pausedMs: (session.pausedMs ?? 0) + pausedExtra, effort, note: note || undefined }, true);
    setFinishing(false);
    router.replace(`/session/summary/${done.id}`);
  };

  const discard = async () => {
    if (!(await confirm('Discard workout?', 'This workout will be marked as abandoned and won’t count toward your progress.', 'Discard'))) return;
    commit({ ...session, status: 'abandoned', endedAt: nowIso() }, true);
    router.back();
  };

  const completedCount = session.exercises.reduce((s, e) => s + e.sets.filter((x) => x.completed && x.kind === 'working').length, 0);
  const sharpStop = ex?.discomfort && (ex.discomfort.sharp || ex.discomfort.severity >= 7);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
        <IconButton icon="chevron-down" label="Minimise workout" onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1}>{session.name}</Text>
          <Text variant="caption" tone="muted">{session.exercises.length ? `${index + 1} of ${session.exercises.length} exercises` : 'Add your first exercise'} · {completedCount} sets done</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="label" tone={paused ? 'warning' : 'primary'} accessibilityLabel={`Elapsed ${fmt(elapsed)}`}>{fmt(elapsed)}</Text>
          {paused ? <Text variant="caption" tone="warning">Paused</Text> : null}
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {session.exercises.map((e, i) => (
            <Pressable key={e.key} accessibilityRole="button" accessibilityLabel={`Go to ${EXERCISE_MAP.get(e.exerciseId)?.name}`} onPress={() => setIndex(i)} style={{ flex: 1, minWidth: 20, height: 6, borderRadius: 3, backgroundColor: i === index ? c.primary : e.sets.length && e.sets.every((s) => s.completed) ? c.accent : c.surfaceRaised }} />
          ))}
        </View>

        {ex && def ? (
          <Card style={{ flex: 1, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text variant="title" style={{ fontSize: 22 }}>{def.name}</Text>
                <Text variant="caption" tone="muted">
                  {def.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
                  {planned ? ` · Target ${planned.sets}×${def.timed ? `${planned.durationSec ?? 30}s` : `${planned.repsMin}–${planned.repsMax}`}${planned.targetRir !== undefined ? ` · ${planned.targetRir} reps in reserve` : ''}` : ''}
                  {ex.substitutedFrom ? ` · swapped from ${EXERCISE_MAP.get(ex.substitutedFrom)?.name}` : ''}
                </Text>
              </View>
              <IconButton icon="information-circle-outline" label="How to do it" onPress={() => router.push(`/exercises/${def.id}`)} />
            </View>
            {prev ? (
              <Text variant="caption" tone="subtle">
                Last time ({prev.dayKey}): {prev.sets.map((s) => (def.timed ? `${s.durationSec}s` : `${s.reps}×${toDisplay(s.weightKg)}${units === 'imperial' ? 'lb' : 'kg'}`)).join(', ')}
                {suggestion ? ` · ${suggestion.reason}` : ''}
              </Text>
            ) : (
              <Text variant="caption" tone="subtle">First time logging this — choose a comfortable load and focus on form.</Text>
            )}
            {sharpStop ? (
              <Banner tone="danger" title="Stop this exercise">Sharp or strong pain is a signal to stop. Swap to a comfortable alternative or end here. If it persists or worsens, consider a professional assessment.</Banner>
            ) : null}

            <View style={{ gap: 8 }}>
              {ex.sets.map((s, si) => (
                <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, backgroundColor: s.completed ? c.surfaceRaised : 'transparent', borderWidth: 1, borderColor: s.completed ? c.accent : c.border }}>
                  <Text variant="label" tone={s.kind === 'warmup' ? 'subtle' : 'muted'} style={{ width: 28 }}>{s.kind === 'warmup' ? 'W' : si + 1 - ex.sets.filter((x, j) => j < si && x.kind === 'warmup').length}</Text>
                  {def.timed ? (
                    <MiniStepper label="sec" value={s.durationSec ?? 30} step={5} onChange={(v) => updateSet(si, { durationSec: v })} />
                  ) : (
                    <>
                      <MiniStepper label="reps" value={s.reps ?? 0} step={1} onChange={(v) => updateSet(si, { reps: v })} />
                      {!def.equipment.every((e) => e === 'bodyweight') || (s.weightKg ?? 0) > 0 ? (
                        <MiniStepper label={units === 'imperial' ? 'lb' : 'kg'} value={toDisplay(s.weightKg)} step={step} onChange={(v) => updateSet(si, { weightKg: fromDisplay(v) })} />
                      ) : null}
                    </>
                  )}
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: s.completed }}
                    accessibilityLabel={`Set ${si + 1} complete`}
                    testID={`set-${si}-complete`}
                    onPress={() => toggleComplete(si)}
                    onLongPress={() => removeSet(si)}
                    style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: s.completed ? c.accent : c.surfaceSunken, marginLeft: 'auto' }}>
                    <Ionicons name="checkmark" size={22} color={s.completed ? c.primaryText : c.textSubtle} />
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button label="Add set" icon="add" size="sm" variant="secondary" onPress={addSet} />
              <Button label="Swap" icon="swap-horizontal" size="sm" variant="secondary" onPress={() => setPicker(true)} />
              <Button label="Discomfort" icon="medkit-outline" size="sm" variant="secondary" onPress={() => setDiscomfortOpen(true)} />
            </View>
            <Field label="Notes" placeholder="Optional" value={ex.note ?? ''} onChangeText={(t) => commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, note: t || undefined } : e)) })} />
          </Card>
        ) : (
          <Card>
            <Text tone="muted">No exercises yet.</Text>
          </Card>
        )}

        {restEndsAt ? (
          <Card variant="hero" accessibilityLabel="Rest timer">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="overline" tone="primary">Rest</Text>
                <Text variant="display" accessibilityLiveRegion="polite">{fmt(restEndsAt - now)}</Text>
              </View>
              <Button label="+15s" size="sm" variant="secondary" onPress={() => setRestEndsAt((t) => (t ?? Date.now()) + 15000)} />
              <Button label="Skip" size="sm" variant="ghost" onPress={() => setRestEndsAt(undefined)} />
            </View>
          </Card>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderColor: c.border }}>
        <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume workout' : 'Pause workout'} onPress={togglePause} />
        <Button label="Prev" variant="secondary" size="sm" disabled={index === 0} onPress={() => setIndex((i) => Math.max(0, i - 1))} />
        {index < session.exercises.length - 1 ? (
          <Button label="Next exercise" style={{ flex: 1 }} onPress={() => setIndex((i) => i + 1)} />
        ) : (
          <Button label="Finish" testID="finish-workout" icon="flag" style={{ flex: 1 }} onPress={() => setFinishing(true)} />
        )}
        <IconButton icon="add" label="Add exercise" onPress={() => { setIndex(session.exercises.length); setPicker(true); }} />
      </View>

      <ExercisePicker
        visible={picker}
        title={ex && index < session.exercises.length ? 'Swap exercise' : 'Add exercise'}
        suggestIds={def?.substitutions}
        onClose={() => setPicker(false)}
        onPick={(picked) => {
          if (ex && index < session.exercises.length) {
            commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, exerciseId: picked.id, substitutedFrom: e.substitutedFrom ?? e.exerciseId, sets: e.sets.map((s) => ({ ...s, completed: false, weightKg: undefined, durationSec: picked.timed ? 30 : undefined, reps: picked.timed ? undefined : s.reps })), discomfort: undefined } : e)) });
          } else {
            commit({ ...session, exercises: [...session.exercises, { key: `x${Date.now()}`, exerciseId: picked.id, restSec: 90, sets: Array.from({ length: 3 }, () => ({ kind: 'working' as const, reps: picked.timed ? undefined : 10, durationSec: picked.timed ? 30 : undefined, completed: false })) }] });
            setIndex(session.exercises.length);
          }
        }}
      />
      <FinishModal visible={finishing} onClose={() => setFinishing(false)} onFinish={finish} onDiscard={discard} />
      <DiscomfortModal
        visible={discomfortOpen}
        onClose={() => setDiscomfortOpen(false)}
        onSave={(d) => {
          commit({ ...session, exercises: session.exercises.map((e, i) => (i === index ? { ...e, discomfort: d } : e)) }, true);
          setDiscomfortOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function MiniStepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${value} ${label}`} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={(e) => onChange(Math.max(0, value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}>
      <Pressable accessibilityLabel={`Decrease ${label}`} onPress={() => onChange(Math.max(0, round(value - step, 2)))} hitSlop={6} style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="remove" size={18} color={c.textMuted} />
      </Pressable>
      <View style={{ alignItems: 'center', minWidth: 44 }}>
        <Text variant="label" style={{ fontSize: 17 }}>{value}</Text>
        <Text variant="caption" tone="subtle" style={{ fontSize: 10 }}>{label}</Text>
      </View>
      <Pressable accessibilityLabel={`Increase ${label}`} onPress={() => onChange(round(value + step, 2))} hitSlop={6} style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="add" size={18} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

function FinishModal({ visible, onClose, onFinish, onDiscard }: { visible: boolean; onClose: () => void; onFinish: (effort: number | undefined, note: string) => void; onDiscard: () => void }) {
  const { c } = useTheme();
  const [effort, setEffort] = useState(7);
  const [rate, setRate] = useState(true);
  const [note, setNote] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.surface, padding: 20, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text variant="heading">Finish workout</Text>
          <Toggle label="Rate overall effort" value={rate} onChange={setRate} />
          {rate ? <Stepper label="Effort (1 easy – 10 maximal)" value={effort} min={1} max={10} onChange={setEffort} /> : null}
          <Field label="How did it go?" placeholder="Optional note" value={note} onChangeText={setNote} multiline />
          <Button label="Save workout" testID="save-workout" onPress={() => onFinish(rate ? effort : undefined, note)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Keep going" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button label="Discard" variant="danger" onPress={onDiscard} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DiscomfortModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (d: { area: string; severity: number; sharp: boolean }) => void }) {
  const { c } = useTheme();
  const [area, setArea] = useState('knee');
  const [severity, setSeverity] = useState(3);
  const [sharp, setSharp] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.surface, padding: 20, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <Text variant="heading">Report discomfort</Text>
          <ChipGroup scroll options={['knee', 'hip', 'lower back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck', 'other'].map((a) => ({ value: a, label: a }))} value={area} onChange={(v) => setArea(v as string)} />
          <Stepper label="How strong? (0–10)" value={severity} min={0} max={10} onChange={setSeverity} />
          <Toggle label="Sharp or stabbing pain" value={sharp} onChange={setSharp} />
          <Text variant="caption" tone="muted">Stop any movement that causes sharp or worsening pain. For a detailed record, use Recovery → Knee Health → Log discomfort.</Text>
          <Button label="Save" onPress={() => onSave({ area, severity, sharp })} />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
