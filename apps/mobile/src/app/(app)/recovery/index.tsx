import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  JOINT_EDUCATION,
  JOINT_LABEL,
  MOBILITY_ROUTINES,
  assessDiscomfort,
  completedSetCount,
  daysBetween,
  lastNDays,
  recoveryEstimate,
  type DiscomfortLog,
  type RecoveryCheckIn,
  type SleepLog,
} from '@forma/shared';
import { useCollection } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { useSessions, useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChipGroup, ListRow } from '@/components/ui/Controls';
import { Banner, Badge, EmptyState, Row, Stat } from '@/components/ui/Feedback';
import { BarChart, LineChart } from '@/components/charts/Charts';
import { SafetyCard } from '@/components/SafetyCard';

type Tab = 'overview' | 'knee' | 'mobility' | 'sleep' | 'joints' | 'history';

export default function Recovery() {
  const { c } = useTheme();
  const today = useToday();
  const { profile } = useProfile();
  const feature = useFeature('recovery');
  const knee = useFeature('kneeHealth');
  const [tab, setTab] = useState<Tab>('overview');
  const { items: checkIns } = useCollection<RecoveryCheckIn>('recoveryCheckIns', { orderBy: 'dayKey', limit: 60 });
  const { items: sleep } = useCollection<SleepLog>('sleepLogs', { orderBy: 'dayKey', limit: 14 });
  const { items: discomfort } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 30 });
  const { items: sessions } = useSessions();
  const checkIn = checkIns.find((x) => x.dayKey === today);
  const lastSleep = sleep.find((s) => daysBetween(s.dayKey, today) <= 1);
  const load = useMemo(() => {
    const done = sessions.filter((s) => s.status === 'completed');
    const sets = (days: number) => done.filter((s) => { const d = daysBetween(s.dayKey, today); return d >= 0 && d < days; }).reduce((a, s) => a + completedSetCount(s), 0);
    const recent = sets(3);
    const baseline = (sets(28) / 28) * 3;
    return { recent, baseline, frequency7: done.filter((s) => daysBetween(s.dayKey, today) < 7).length };
  }, [sessions, today]);
  const recentDiscomfort = discomfort.filter((d) => daysBetween(d.dayKey, today) < 3 && d.severity >= 4);
  const est = recoveryEstimate({ checkIn, sleepHours: lastSleep ? lastSleep.durationMin / 60 : undefined, sleepTargetHours: profile?.sleepTargetHours, recentSets: load.baseline > 0 ? load.recent : undefined, baselineSets: load.baseline > 0 ? load.baseline : undefined, recentDiscomfort: recentDiscomfort.length > 0 });
  const latest = discomfort[0] && daysBetween(discomfort[0].dayKey, today) < 7 ? assessDiscomfort(discomfort[0]) : undefined;
  const focus = est.band === 'good' ? MOBILITY_ROUTINES.find((r) => r.id === 'general-warmup')! : est.band === 'moderate' ? MOBILITY_ROUTINES.find((r) => r.id === 'hips-mobility')! : MOBILITY_ROUTINES.find((r) => r.id === 'yoga-flow')!;

  if (!feature.enabled) return <Screen title="Recovery" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Recovery & joint health" back>
      <ChipGroup
        scroll
        options={[
          { value: 'overview', label: 'Overview' },
          ...(knee.enabled ? [{ value: 'knee', label: 'Knee' }] : []),
          { value: 'mobility', label: 'Mobility' },
          { value: 'sleep', label: 'Sleep & fatigue' },
          { value: 'joints', label: 'Joint strengthening' },
          { value: 'history', label: 'Check-in history' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />
      {latest && latest.level !== 'ok' && latest.level !== 'modify' ? <SafetyCard assessment={latest} /> : null}

      {tab === 'overview' && (
        <>
          <Card variant="hero" style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: est.band === 'good' ? c.success : est.band === 'moderate' ? c.warning : est.band === 'low' ? c.danger : c.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="title">{est.score ?? '—'}</Text>
                <Text variant="caption" tone="subtle">/ 100</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="overline" tone="primary">Recovery estimate</Text>
                <Text variant="label">{est.score === null ? 'Not enough information yet' : est.band === 'good' ? 'Looking good' : est.band === 'moderate' ? 'Take it a bit easier' : 'Prioritise recovery'}</Text>
                <Text variant="caption" tone="muted">{est.explanation}</Text>
              </View>
            </View>
            <Button label={checkIn ? 'Update today’s check-in' : 'Do today’s check-in'} icon="pulse" testID="recovery-checkin" size="sm" onPress={() => router.push('/recovery/check-in')} />
          </Card>
          <Card>
            <Text variant="heading" style={{ marginBottom: 6 }}>How this is calculated</Text>
            {est.components.map((x) => (
              <View key={x.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text variant="caption">{x.label} · {x.detail}</Text>
                <Text variant="caption" tone="muted">{x.score}/100 × {Math.round(x.weight * 100)}%</Text>
              </View>
            ))}
            {est.missing.length ? <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>Missing: {est.missing.join(', ')} — these aren’t guessed.</Text> : null}
            <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>{est.disclaimer}</Text>
          </Card>
          <Row wrap>
            <Stat icon="moon-outline" label="Sleep" value={lastSleep ? `${(lastSleep.durationMin / 60).toFixed(1)}` : '—'} unit="h" note={lastSleep ? (lastSleep.source === 'healthkit' ? 'Apple Health' : 'Self-reported') : 'Not logged'} />
            <Stat icon="barbell-outline" label="Sets (3 days)" value={String(load.recent)} note={load.baseline ? `Usual ≈ ${Math.round(load.baseline)}` : 'Building baseline'} />
            <Stat icon="calendar-outline" label="Sessions (7 days)" value={String(load.frequency7)} />
            <Stat icon="medkit-outline" label="Discomfort" value={recentDiscomfort.length ? 'Reported' : 'None'} note="Last 3 days, 4+/10" />
          </Row>
          <Card>
            <Text variant="heading" style={{ marginBottom: 6 }}>Today’s focus</Text>
            <ListRow icon="leaf-outline" title={focus.name} subtitle={`${focus.minutes} min · ${focus.description}`} onPress={() => router.push(`/mobility/${focus.id}`)} />
          </Card>
          <Text variant="heading">Quick access</Text>
          <Row wrap>
            {[
              { icon: 'walk-outline', label: 'Knee health', go: '/recovery/knee', show: knee.enabled },
              { icon: 'git-network-outline', label: 'Joint care', go: '/recovery/joints?joint=hip', show: true },
              { icon: 'body-outline', label: 'Stretching', go: '/mobility', show: true },
              { icon: 'cloud-outline', label: 'Breathing', go: '/mobility/post-workout-cooldown', show: true },
              { icon: 'document-text-outline', label: 'Clinician notes', go: '/clinician', show: true },
            ].filter((q) => q.show).map((q) => (
              <Card key={q.label} onPress={() => router.push(q.go as never)} style={{ minWidth: 100, flex: 1, alignItems: 'center', gap: 6 }} accessibilityLabel={q.label}>
                <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={24} color={c.primary} />
                <Text variant="caption">{q.label}</Text>
              </Card>
            ))}
          </Row>
        </>
      )}

      {tab === 'knee' && (
        <Card style={{ gap: 10 }}>
          <Text variant="heading">Knee health</Text>
          <Text tone="muted">Log discomfort, explore knee-friendly strengthening and mobility, and see clear guidance on when to get checked.</Text>
          <Button label="Open Knee Health" icon="walk-outline" onPress={() => router.push('/recovery/knee')} />
          <Button label="Log knee discomfort" variant="secondary" onPress={() => router.push('/recovery/discomfort?joint=knee')} />
        </Card>
      )}

      {tab === 'mobility' && MOBILITY_ROUTINES.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/mobility/${r.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{r.name}</Text>
              <Text variant="caption" tone="muted">{r.minutes} min · {r.description}</Text>
            </View>
            {r.kneeFriendly ? <Badge label="Knee-friendly" tone="success" /> : null}
          </View>
        </Card>
      ))}

      {tab === 'sleep' && (
        <>
          <Card>
            <Text variant="label">Sleep, last 7 nights (h)</Text>
            <BarChart data={lastNDays(today, 7).map((d) => ({ x: d.slice(8), y: Math.round(((sleep.find((s) => s.dayKey === d)?.durationMin ?? 0) / 60) * 10) / 10 }))} target={profile?.sleepTargetHours} />
          </Card>
          <Card>
            <Text variant="label">Fatigue (1–5)</Text>
            <LineChart data={checkIns.filter((x) => x.fatigue).slice().reverse().map((x) => ({ x: x.dayKey, y: x.fatigue! }))} emptyMessage="Check in on a few days to see a trend." />
          </Card>
          <ListRow icon="moon-outline" title="Sleep log & tips" onPress={() => router.push('/sleep')} />
        </>
      )}

      {tab === 'joints' && JOINT_EDUCATION.map((j) => (
        <Card key={j.joint} onPress={() => router.push(j.joint === 'knee' ? '/recovery/knee' : `/recovery/joints?joint=${j.joint}`)}>
          <Text variant="label">{j.title}</Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>{j.intro}</Text>
        </Card>
      ))}

      {tab === 'history' && (
        <>
          {checkIns.length || discomfort.length ? null : <EmptyState icon="pulse-outline" title="No check-ins yet" message="Your daily check-ins and discomfort logs appear here." actionLabel="Check in" onAction={() => router.push('/recovery/check-in')} />}
          {checkIns.length ? (
            <Card>
              <Text variant="heading" style={{ marginBottom: 6 }}>Check-ins</Text>
              {checkIns.slice(0, 20).map((x) => <ListRow key={x.id} title={x.dayKey} subtitle={`Sleep ${x.sleepHours ?? '–'}h · soreness ${x.soreness ?? '–'}/5 · fatigue ${x.fatigue ?? '–'}/5 · stress ${x.stress ?? '–'}/5`} />)}
            </Card>
          ) : null}
          {discomfort.length ? (
            <Card>
              <Text variant="heading" style={{ marginBottom: 6 }}>Discomfort logs</Text>
              {discomfort.map((d) => <ListRow key={d.id} title={`${d.dayKey} · ${JOINT_LABEL[d.joint]} (${d.side})`} subtitle={`${d.severity}/10 · ${d.location} · trend ${d.trend.replace('_', ' ')} · ${assessDiscomfort(d).headline}`} />)}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
