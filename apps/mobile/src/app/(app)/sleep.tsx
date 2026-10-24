import { useState } from 'react';
import { addDays, lastNDays, sleepLogSchema, EDUCATION, type SleepLog } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented, Stepper, Field, ListRow } from '@/components/ui/Controls';
import { Badge, Banner, Row, Stat } from '@/components/ui/Feedback';
import { BarChart, ProgressRing } from '@/components/charts/Charts';
import { router } from 'expo-router';

export default function Sleep() {
  const today = useToday();
  const { profile } = useProfile();
  const { items } = useCollection<SleepLog>('sleepLogs', { orderBy: 'dayKey', limit: 60 });
  const { save, remove } = useMutations();
  const feature = useFeature('sleep');
  const [tab, setTab] = useState<'overview' | 'log' | 'tips'>('overview');
  const [hours, setHours] = useState(7);
  const [minutes, setMinutes] = useState(30);
  const [quality, setQuality] = useState(3);
  const [day, setDay] = useState(today);
  const [msg, setMsg] = useState<string>();
  const target = profile?.sleepTargetHours ?? 8;
  const last = items[0];
  const week = lastNDays(today, 7).map((d) => ({ x: d.slice(8), y: Math.round(((items.find((s) => s.dayKey === d)?.durationMin ?? 0) / 60) * 10) / 10 }));
  const logged7 = items.filter((s) => lastNDays(today, 7).includes(s.dayKey));
  const avg = logged7.length ? logged7.reduce((a, s) => a + s.durationMin, 0) / logged7.length / 60 : undefined;

  const log = async () => {
    const existing = items.find((s) => s.dayKey === day && s.source === 'manual');
    const id = existing?.id ?? `s${day.replace(/-/g, '')}`;
    const parsed = sleepLogSchema.safeParse({ id, dayKey: day, durationMin: hours * 60 + minutes, quality, createdAt: existing?.createdAt ?? nowIso(), updatedAt: nowIso(), revision: (existing?.revision ?? 0) + 1, source: 'manual' });
    if (!parsed.success) return setMsg('Please check the values.');
    await save('sleepLogs', id, parsed.data);
    setMsg('Saved.');
    setTab('overview');
  };

  if (!feature.enabled) return <Screen title="Sleep" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Sleep" back>
      <Segmented options={[{ value: 'overview', label: 'Overview' }, { value: 'log', label: 'Log' }, { value: 'tips', label: 'Tips' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && (
        <>
          <Card style={{ alignItems: 'center', gap: 10 }}>
            <ProgressRing value={last ? last.durationMin / 60 : 0} max={target} size={170} label={last ? `${Math.floor(last.durationMin / 60)}h ${last.durationMin % 60}m` : '—'} sublabel={last ? `Night ending ${last.dayKey}` : 'No sleep logged'} />
            {last ? <Badge label={last.source === 'healthkit' ? 'Imported from Apple Health (device estimate)' : 'Self-reported'} tone={last.source === 'healthkit' ? 'primary' : 'default'} /> : null}
            {last?.stages ? <Text variant="caption" tone="muted">Deep {Math.round(last.stages.deep ?? 0)}m · Core {Math.round(last.stages.core ?? 0)}m · REM {Math.round(last.stages.rem ?? 0)}m · Awake {Math.round(last.stages.awake ?? 0)}m</Text> : null}
          </Card>
          <Row wrap>
            <Stat icon="moon-outline" label="7-night average" value={avg ? avg.toFixed(1) : '—'} unit="h" note={`${logged7.length} of 7 nights logged`} />
            <Stat icon="flag-outline" label="Your goal" value={String(target)} unit="h" note="Change in Settings → Profile" />
          </Row>
          <Card>
            <Text variant="label">Last 7 nights (hours)</Text>
            <BarChart data={week} target={target} />
          </Card>
          <Button label="Log last night" icon="add" onPress={() => setTab('log')} />
          <ListRow icon="phone-portrait-outline" title="Import from Apple Health" subtitle="More → Health Sync" onPress={() => router.push('/health-sync')} />
          <Card>
            {items.slice(0, 14).map((s) => (
              <ListRow key={s.id} title={`${s.dayKey} · ${Math.floor(s.durationMin / 60)}h ${s.durationMin % 60}m`} subtitle={`${s.source === 'healthkit' ? 'Apple Health' : 'Self-reported'}${s.quality ? ` · quality ${s.quality}/5` : ''}`} right={<IconButton icon="trash-outline" label="Delete" tone="danger" onPress={() => remove('sleepLogs', s.id)} />} />
            ))}
          </Card>
        </>
      )}
      {tab === 'log' && (
        <Card style={{ gap: 14 }}>
          <Field label="Night ending (wake-up date)" value={day} onChangeText={setDay} hint={`e.g. ${today} or ${addDays(today, -1)}`} />
          <Row>
            <Stepper label="Hours" value={hours} min={0} max={16} onChange={setHours} />
            <Stepper label="Minutes" value={minutes} step={15} min={0} max={45} onChange={setMinutes} />
          </Row>
          <Stepper label="How rested do you feel? (1–5)" value={quality} min={1} max={5} onChange={setQuality} />
          <Button label="Save" onPress={log} />
          {msg ? <Text variant="caption" tone="success">{msg}</Text> : null}
        </Card>
      )}
      {tab === 'tips' && EDUCATION.filter((e) => e.topic === 'sleep' || e.topic === 'stress').map((e) => (
        <Card key={e.id}><Text variant="label">{e.title}</Text><Text tone="muted" style={{ marginTop: 4 }}>{e.body}</Text></Card>
      ))}
      <Text variant="caption" tone="subtle">Sleep data is for general wellness. If you regularly struggle with sleep, snoring with pauses in breathing, or daytime sleepiness, talk to a doctor.</Text>
    </Screen>
  );
}
