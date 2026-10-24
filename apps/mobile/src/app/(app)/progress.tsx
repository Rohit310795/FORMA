import { useState } from 'react';
import { router } from 'expo-router';
import {
  EXERCISE_MAP,
  adherence,
  consistency,
  estimateOneRepMax,
  formatWeight,
  lastNDays,
  personalRecords,
  sessionVolumeKg,
  weekStart,
  type NutritionEntry,
  type RecoveryCheckIn,
  type SleepLog,
} from '@forma/shared';
import { useCollection } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { useSessions, useTargets, useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChipGroup, Segmented, ListRow } from '@/components/ui/Controls';
import { Banner, EmptyState, Row, Stat } from '@/components/ui/Feedback';
import { BarChart, LineChart } from '@/components/charts/Charts';

export default function Progress() {
  const today = useToday();
  const { profile } = useProfile();
  const units = profile?.units ?? 'metric';
  const { items: sessions } = useSessions();
  const { items: meals } = useCollection<NutritionEntry>('nutritionLogs', { orderBy: 'dayKey', limit: 600 });
  const { items: sleep } = useCollection<SleepLog>('sleepLogs', { orderBy: 'dayKey', limit: 28 });
  const { items: checkIns } = useCollection<RecoveryCheckIn>('recoveryCheckIns', { orderBy: 'dayKey', limit: 28 });
  const { data: targets } = useTargets();
  const ai = useFeature('progressInsights');
  const [tab, setTab] = useState<'overview' | 'strength' | 'wellness'>('overview');
  const [summary, setSummary] = useState<{ text: string; disclaimers: string[] }>();
  const [busy, setBusy] = useState(false);
  const completed = sessions.filter((s) => s.status === 'completed');
  const cons = consistency(sessions, today, 8);
  const weeklyVolume = cons.weeks.map((w) => ({ x: w.weekStart.slice(5), y: Math.round(completed.filter((s) => weekStart(s.dayKey) === w.weekStart).reduce((a, s) => a + sessionVolumeKg(s), 0)) }));
  const prs = personalRecords(sessions);
  const loggedExercises = [...prs.keys()];
  const [exercise, setExercise] = useState<string>();
  const ex = exercise ?? loggedExercises[0];
  const e1rmSeries = (() => {
    if (!ex) return [];
    return completed
      .slice()
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      .map((s) => {
        const best = Math.max(0, ...s.exercises.filter((e) => e.exerciseId === ex).flatMap((e) => e.sets.filter((x) => x.completed && x.kind === 'working').map((x) => estimateOneRepMax(x.weightKg ?? 0, x.reps ?? 0) ?? 0)));
        return { x: s.dayKey, y: best };
      })
      .filter((p) => p.y > 0);
  })();

  const days28 = lastNDays(today, 28);
  const kcalByDay = new Map<string, number>();
  meals.forEach((m) => kcalByDay.set(m.dayKey, (kcalByDay.get(m.dayKey) ?? 0) + m.macros.kcal));
  const adh = targets ? adherence(kcalByDay, targets.kcal, days28) : undefined;
  const sleep7 = lastNDays(today, 7).map((d) => ({ x: d.slice(8), y: Math.round(((sleep.find((s) => s.dayKey === d)?.durationMin ?? 0) / 60) * 10) / 10 }));

  const runSummary = async () => {
    setBusy(true);
    try {
      const res = await api.aiChat({ routeKey: 'progressSummary', message: 'Summarise my progress over the last four weeks and suggest one or two realistic next steps.' });
      setSummary({ text: res.message.content, disclaimers: res.message.disclaimers });
    } catch (e) {
      setSummary({ text: apiErrorMessage(e), disclaimers: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Your progress" subtitle="Based only on what you’ve logged" back>
      <Segmented options={[{ value: 'overview', label: 'Overview' }, { value: 'strength', label: 'Strength' }, { value: 'wellness', label: 'Wellness' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && (
        <>
          <Row wrap>
            <Stat icon="calendar-outline" label="Last 7 days" value={String(cons.sessionsLast7)} unit="workouts" />
            <Stat icon="calendar-number-outline" label="Last 28 days" value={String(cons.sessionsLast28)} unit="workouts" />
            <Stat icon="flame-outline" tone="accent" label="Streak" value={String(cons.currentStreakWeeks)} unit="weeks" note="Weeks with ≥1 workout" />
            <Stat icon="trophy-outline" label="Exercises with records" value={String(prs.size)} />
          </Row>
          <Card>
            <Text variant="label">Workouts per week (8 weeks)</Text>
            <BarChart data={cons.weeks.map((w) => ({ x: w.weekStart.slice(5), y: w.sessions }))} target={profile?.trainingDays?.length || undefined} />
          </Card>
          <Card>
            <Text variant="label">Weekly training volume ({units === 'imperial' ? 'kg-equivalent' : 'kg'})</Text>
            <BarChart data={weeklyVolume} />
            <Text variant="caption" tone="subtle">Volume = reps × load for completed working sets. More isn’t always better; consistency matters most.</Text>
          </Card>
          <ListRow icon="body-outline" title="Body measurements & photos" onPress={() => router.push('/body')} />
          {ai.enabled ? (
            <Card variant="hero">
              <Text variant="heading">AI progress summary</Text>
              <Text variant="caption" tone="muted" style={{ marginVertical: 6 }}>Uses the categories you allow in Privacy. It describes trends; it can’t prove why something changed.</Text>
              <Button label="Summarise my last 4 weeks" icon="sparkles" onPress={runSummary} loading={busy} size="sm" />
              {summary ? <Text style={{ marginTop: 10 }}>{summary.text}</Text> : null}
              {summary?.disclaimers.map((d) => <Text key={d} variant="caption" tone="subtle">{d}</Text>)}
            </Card>
          ) : null}
        </>
      )}
      {tab === 'strength' && (
        <>
          {loggedExercises.length ? (
            <>
              <ChipGroup scroll options={loggedExercises.map((id) => ({ value: id, label: EXERCISE_MAP.get(id)?.name ?? id }))} value={ex ?? ''} onChange={(v) => setExercise(v as string)} />
              <Card>
                <Text variant="label">Estimated 1-rep max trend</Text>
                <LineChart data={e1rmSeries} unit="kg" emptyMessage="Log this exercise with weight and reps on at least two days." />
                <Text variant="caption" tone="subtle">Estimated with the Epley formula from sets of 12 reps or fewer.</Text>
              </Card>
              <Card>
                <Text variant="heading" style={{ marginBottom: 6 }}>Personal records</Text>
                {loggedExercises.map((id) => {
                  const r = prs.get(id)!;
                  return <ListRow key={id} title={EXERCISE_MAP.get(id)?.name ?? id} subtitle={`Heaviest ${r.heaviest ? `${formatWeight(r.heaviest.value, units)} × ${r.heaviest.reps} (${r.heaviest.dayKey})` : '—'} · e1RM ${r.e1rm ? formatWeight(r.e1rm.value, units) : '—'}`} />;
                })}
              </Card>
            </>
          ) : (
            <EmptyState icon="barbell-outline" title="No strength data yet" message="Complete a workout with weights to see records and trends." />
          )}
        </>
      )}
      {tab === 'wellness' && (
        <>
          {adh ? (
            <Card>
              <Text variant="label">Calorie target adherence (28 days)</Text>
              <Text variant="title" style={{ marginVertical: 6 }}>{adh.withinDays} / {adh.loggedDays} logged days</Text>
              <Text variant="caption" tone="muted">Days within ±10% of your {targets!.kcal} kcal target, out of days you logged ({adh.loggedDays} of 28). Logged values are estimates.</Text>
            </Card>
          ) : <Banner tone="info">Set nutrition targets to see adherence.</Banner>}
          <Card>
            <Text variant="label">Sleep, last 7 nights (hours)</Text>
            <BarChart data={sleep7} target={profile?.sleepTargetHours} />
          </Card>
          <Card>
            <Text variant="label">Soreness & fatigue check-ins</Text>
            <LineChart data={checkIns.filter((c) => c.fatigue).slice().reverse().map((c) => ({ x: c.dayKey, y: c.fatigue! }))} emptyMessage="Do a few recovery check-ins to see a trend." />
            <Text variant="caption" tone="subtle">Fatigue on a 1–5 scale. Patterns can line up with training or sleep, but that doesn’t prove one caused the other.</Text>
          </Card>
        </>
      )}
    </Screen>
  );
}
