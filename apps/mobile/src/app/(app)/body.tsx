import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import {
  GOALS,
  GOAL_LABELS,
  MEASUREMENT_LABELS,
  MEASUREMENT_SITES,
  bodyMeasurementSchema,
  cmToIn,
  formatLength,
  formatWeight,
  kgToLb,
  movingAverage,
  round,
  toCm,
  toKg,
  trend,
  type BodyMeasurement,
  type GoalRecord,
  type MeasurementSite,
  type ProgressPhoto,
} from '@forma/shared';
import { useCollection, useData, useMutations, type WithPending } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { storage } from '@/lib/firebase';
import { confirm } from '@/lib/confirm';
import { newId, nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, NumberField, Segmented, ListRow } from '@/components/ui/Controls';
import { Banner, EmptyState, SectionHeader } from '@/components/ui/Feedback';
import { LineChart } from '@/components/charts/Charts';

export default function MyBody() {
  const { profile, save: saveProfile } = useProfile();
  const { uid } = useData();
  const today = useToday();
  const { items } = useCollection<BodyMeasurement>('bodyMeasurements', { orderBy: 'dayKey', limit: 365 });
  const { items: goals } = useCollection<GoalRecord>('goals');
  const { items: photos } = useCollection<ProgressPhoto>('progressPhotos', { orderBy: 'dayKey' });
  const { save, remove } = useMutations();
  const units = profile?.units ?? 'metric';
  const [tab, setTab] = useState<'log' | 'history' | 'goals' | 'photos'>('log');
  const [weight, setWeight] = useState<number>();
  const [sites, setSites] = useState<Partial<Record<MeasurementSite, number>>>({});
  const [bodyFat, setBodyFat] = useState<number>();
  const [method, setMethod] = useState<BodyMeasurement['bodyFatMethod']>('scale_bia');
  const [metric, setMetric] = useState<'weight' | MeasurementSite>('weight');
  const [msg, setMsg] = useState<string>();

  const points = useMemo(
    () =>
      items
        .map((m) => ({ dayKey: m.dayKey, value: metric === 'weight' ? m.weightKg : m.sites?.[metric] }))
        .filter((p): p is { dayKey: string; value: number } => p.value !== undefined)
        .map((p) => ({ dayKey: p.dayKey, value: metric === 'weight' ? (units === 'imperial' ? round(kgToLb(p.value), 1) : p.value) : units === 'imperial' ? round(cmToIn(p.value), 1) : p.value })),
    [items, metric, units],
  );
  const smooth = metric === 'weight' ? movingAverage(points) : points;
  const t = trend(points, today, 90, metric === 'weight' ? (units === 'imperial' ? 'lb' : 'kg') : units === 'imperial' ? 'in' : 'cm');

  const logToday = async () => {
    const existing = items.find((m) => m.dayKey === today && !m._pending);
    const id = existing?.id ?? `m${today.replace(/-/g, '')}`;
    const record = bodyMeasurementSchema.safeParse({
      ...(existing ?? {}),
      id,
      dayKey: today,
      weightKg: weight !== undefined ? round(toKg(weight, units), 2) : existing?.weightKg,
      sites: { ...(existing?.sites ?? {}), ...Object.fromEntries(Object.entries(sites).map(([k, v]) => [k, round(toCm(v!, units), 1)])) },
      bodyFatPercent: bodyFat ?? existing?.bodyFatPercent,
      bodyFatMethod: bodyFat !== undefined ? method : existing?.bodyFatMethod,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      revision: (existing?.revision ?? 0) + 1,
      source: 'manual',
    });
    if (!record.success) return setMsg(record.error.issues[0]?.message ?? 'Please check the values.');
    await save('bodyMeasurements', id, record.data);
    if (record.data.weightKg) await saveProfile({ weightKg: record.data.weightKg });
    setMsg('Saved.');
    setSites({});
    setWeight(undefined);
    setBodyFat(undefined);
  };

  return (
    <Screen title="My body" subtitle="Measurements, goals and progress photos" back>
      <Segmented options={[{ value: 'log', label: 'Log' }, { value: 'history', label: 'Trends' }, { value: 'goals', label: 'Goals' }, { value: 'photos', label: 'Photos' }]} value={tab} onChange={setTab} />
      {tab === 'log' && (
        <>
          <Card style={{ gap: 12 }}>
            <Text variant="heading">Today · {today}</Text>
            <NumberField label="Weight" unit={units === 'imperial' ? 'lb' : 'kg'} value={weight} onChange={setWeight} decimals={1} />
            <Text variant="label">Circumferences ({units === 'imperial' ? 'in' : 'cm'}, optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {MEASUREMENT_SITES.map((s) => (
                <View key={s} style={{ width: '47%' }}>
                  <NumberField label={MEASUREMENT_LABELS[s]} value={sites[s]} onChange={(v) => setSites((x) => ({ ...x, [s]: v }))} decimals={1} />
                </View>
              ))}
            </View>
            <NumberField label="Body-fat estimate (optional)" unit="%" value={bodyFat} onChange={setBodyFat} decimals={1} />
            {bodyFat !== undefined ? (
              <>
                <Text variant="caption" tone="muted">How was it estimated? Different methods can disagree by several percentage points.</Text>
                <ChipGroup options={[{ value: 'scale_bia', label: 'Smart scale' }, { value: 'calipers', label: 'Calipers' }, { value: 'dexa', label: 'DEXA' }, { value: 'visual_estimate', label: 'Visual estimate' }, { value: 'other', label: 'Other' }]} value={method ?? 'other'} onChange={(v) => setMethod(v as BodyMeasurement['bodyFatMethod'])} />
              </>
            ) : null}
            <Button label="Save measurements" onPress={logToday} />
            {msg ? <Text variant="caption" tone="success">{msg}</Text> : null}
          </Card>
          <Text variant="caption" tone="subtle">Tip: measure at the same time of day, ideally in the morning. Day-to-day weight changes are mostly water and food.</Text>
        </>
      )}

      {tab === 'history' && (
        <>
          <ChipGroup scroll options={[{ value: 'weight', label: 'Weight' }, ...MEASUREMENT_SITES.map((s) => ({ value: s, label: MEASUREMENT_LABELS[s] }))]} value={metric} onChange={(v) => setMetric(v as typeof metric)} />
          <Card>
            <LineChart data={smooth.map((p) => ({ x: p.dayKey, y: p.value }))} unit={metric === 'weight' ? (units === 'imperial' ? 'lb' : 'kg') : units === 'imperial' ? 'in' : 'cm'} emptyMessage="Log at least two entries to see a chart." />
            <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>{t.description}</Text>
            {metric === 'weight' ? <Text variant="caption" tone="subtle">The line is a 7-entry moving average. Weight alone can’t tell you whether change is fat, muscle or water.</Text> : null}
          </Card>
          <SectionHeader title="All entries" />
          <Card>
            {items.length ? items.slice(0, 30).map((m) => (
              <ListRow
                key={m.id}
                title={m.dayKey}
                subtitle={[m.weightKg ? formatWeight(m.weightKg, units) : null, ...Object.entries(m.sites ?? {}).slice(0, 3).map(([k, v]) => `${MEASUREMENT_LABELS[k as MeasurementSite]} ${formatLength(v as number, units)}`), m.bodyFatPercent ? `${m.bodyFatPercent}% BF (${m.bodyFatMethod?.replace('_', ' ')})` : null].filter(Boolean).join(' · ')}
                right={<IconButton icon="trash-outline" label="Delete entry" tone="danger" onPress={async () => (await confirm('Delete entry?', m.dayKey, 'Delete')) && remove('bodyMeasurements', m.id)} />}
              />
            )) : <EmptyState icon="scale-outline" title="No measurements yet" message="Log your first entry on the Log tab." />}
          </Card>
        </>
      )}

      {tab === 'goals' && <Goals goals={goals} />}

      {tab === 'photos' && <Photos uid={uid} photos={photos} today={today} onDelete={async (p) => { if (!(await confirm('Delete photo?', 'This permanently deletes the photo.', 'Delete'))) return; await deleteObject(ref(storage, p.storagePath)).catch(() => undefined); await remove('progressPhotos', p.id); }} />}
      <Text variant="caption" tone="subtle">Body-shape labels and numbers here are informational only — they don’t limit what you can achieve.</Text>
    </Screen>
  );
}

function Goals({ goals }: { goals: GoalRecord[] }) {
  const { save, remove } = useMutations();
  const [goal, setGoal] = useState<GoalRecord['goal']>('general_fitness');
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState<number>();
  const [targetDate, setTargetDate] = useState('');
  const add = async () => {
    if (!title.trim()) return;
    const id = newId();
    await save('goals', id, { id, goal, title: title.trim(), targetValue, targetDate: /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate : undefined, milestones: [], status: 'active', createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    setTitle('');
    setTargetValue(undefined);
    setTargetDate('');
  };
  return (
    <>
      <Card style={{ gap: 10 }}>
        <Text variant="heading">Add a goal</Text>
        <ChipGroup scroll options={GOALS.map((g) => ({ value: g, label: GOAL_LABELS[g] }))} value={goal} onChange={(v) => setGoal(v as GoalRecord['goal'])} />
        <Field label="Describe it" placeholder="e.g. Squat my bodyweight, walk 8k steps daily" value={title} onChangeText={setTitle} />
        <NumberField label="Target number (optional)" value={targetValue} onChange={setTargetValue} decimals={1} />
        <Field label="Target date (optional)" placeholder="YYYY-MM-DD" value={targetDate} onChangeText={setTargetDate} />
        <Button label="Add goal" onPress={add} />
      </Card>
      {goals.map((g) => (
        <Card key={g.id}>
          <ListRow
            icon={g.status === 'achieved' ? 'trophy' : 'flag-outline'}
            title={g.title}
            subtitle={`${GOAL_LABELS[g.goal]}${g.targetValue ? ` · target ${g.targetValue}` : ''}${g.targetDate ? ` · by ${g.targetDate}` : ''} · ${g.status}`}
            right={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {g.status === 'active' ? <IconButton icon="checkmark-done" label="Mark achieved" onPress={() => save('goals', g.id, { ...g, status: 'achieved', updatedAt: nowIso(), revision: (g.revision ?? 0) + 1 })} /> : null}
                <IconButton icon="trash-outline" label="Delete goal" tone="danger" onPress={() => remove('goals', g.id)} />
              </View>
            }
          />
        </Card>
      ))}
    </>
  );
}

function Photos({ uid, photos, today, onDelete }: { uid: string; photos: WithPending<ProgressPhoto>[]; today: string; onDelete: (p: ProgressPhoto) => void }) {
  const { save } = useMutations();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  useEffect(() => {
    photos.filter((p) => !p._pending && !urls[p.id]).forEach((p) =>
      getDownloadURL(ref(storage, p.storagePath)).then((u) => setUrls((x) => ({ ...x, [p.id]: u })), () => undefined),
    );
  }, [photos, urls]);
  const add = async () => {
    setError(undefined);
    const perm = Platform.OS === 'web' ? { granted: true } : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError('Photo access was not granted. You can enable it in Settings.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    try {
      const id = newId();
      const path = `users/${uid}/progressPhotos/${id}.jpg`;
      const blob = await (await fetch(res.assets[0].uri)).blob();
      await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
      await save('progressPhotos', id, { id, dayKey: today, pose, storagePath: path, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    } catch {
      setError('Upload failed. Photos need a connection to upload.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Banner tone="info" title="Private by design">Photos are stored in your private space — only you can see them. They are never shared with the AI Coach or administrators.</Banner>
      <ChipGroup options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} value={pose} onChange={(v) => setPose(v as ProgressPhoto['pose'])} />
      <Button label="Add progress photo" icon="camera-outline" onPress={add} loading={busy} />
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {photos.map((p) => (
          <View key={p.id} style={{ width: '31%', gap: 4 }}>
            {urls[p.id] ? <Image source={{ uri: urls[p.id] }} accessibilityLabel={`${p.pose} photo from ${p.dayKey}`} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} /> : <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, opacity: 0.2, backgroundColor: 'gray' }} />}
            <Text variant="caption" tone="muted">{p.dayKey} · {p.pose}</Text>
            <Text variant="caption" tone="danger" onPress={() => onDelete(p)} accessibilityRole="button">Delete</Text>
          </View>
        ))}
      </View>
    </>
  );
}
