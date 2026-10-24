import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  GOAL_LABELS,
  consistency,
  recoveryEstimate,
  completedSetCount,
  formatWeight,
  formatVolumeMl,
  trend,
  type HealthSyncMetadata,
  type HydrationLog,
  type NutritionEntry,
  type RecoveryCheckIn,
  type SleepLog,
  type BodyMeasurement,
  type DiscomfortLog,
  assessDiscomfort,
  daysBetween,
} from '@forma/shared';
import { useProfile } from '@/lib/profile';
import { useConfig, useFeature } from '@/lib/config';
import { useCollection, useMutations, useSyncState, useUserDoc } from '@/lib/data';
import { useTheme } from '@/lib/theme';
import { useActivePlan, useSessions, useTargets, useToday, useWeekStrip, planDayFor, nextPlanDay, sessionFromPlanDay } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Banner, Row, SectionHeader, Stat } from '@/components/ui/Feedback';
import { SyncChip } from '@/components/SyncChip';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { c } = useTheme();
  const { profile } = useProfile();
  const { config } = useConfig();
  const today = useToday();
  const { plan } = useActivePlan();
  const { items: sessions } = useSessions();
  const { data: targets } = useTargets();
  const { items: meals } = useCollection<NutritionEntry>('nutritionLogs', { orderBy: 'dayKey', limit: 100 });
  const { items: water } = useCollection<HydrationLog>('hydrationLogs', { orderBy: 'dayKey', limit: 100 });
  const { items: checkIns } = useCollection<RecoveryCheckIn>('recoveryCheckIns', { orderBy: 'dayKey', limit: 7 });
  const { items: sleep } = useCollection<SleepLog>('sleepLogs', { orderBy: 'dayKey', limit: 7 });
  const { items: body } = useCollection<BodyMeasurement>('bodyMeasurements', { orderBy: 'dayKey', limit: 60 });
  const { items: discomfort } = useCollection<DiscomfortLog>('discomfortLogs', { orderBy: 'dayKey', limit: 5 });
  const { data: health } = useUserDoc<HealthSyncMetadata & { today?: { dayKey: string; steps?: number; activeEnergyKcal?: number } }>('settings', 'healthSync');
  const { save } = useMutations();
  const nutrition = useFeature('nutritionInsights');
  const recoveryOn = useFeature('recovery');
  const coach = useFeature('aiCoach');
  const sync = useSyncState();

  const todayDay = planDayFor(plan, today);
  const upNext = nextPlanDay(plan, today);
  const doneToday = sessions.find((s) => s.dayKey === today && s.status === 'completed');
  const inProgress = sessions.find((s) => s.status === 'in_progress' || s.status === 'paused');
  const week = useWeekStrip(sessions, today);
  const cons = useMemo(() => consistency(sessions, today, 8), [sessions, today]);
  const todaysMeals = meals.filter((m) => m.dayKey === today);
  const kcal = todaysMeals.reduce((s, m) => s + m.macros.kcal, 0);
  const protein = todaysMeals.reduce((s, m) => s + m.macros.proteinG, 0);
  const ml = water.filter((w) => w.dayKey === today).reduce((s, w) => s + w.ml, 0);
  const checkIn = checkIns.find((x) => x.dayKey === today);
  const lastSleep = sleep[0];
  const recentDiscomfort = discomfort.find((d) => daysBetween(d.dayKey, today) < 3 && d.severity >= 4);
  const rec = recoveryEstimate({ checkIn, sleepHours: lastSleep && daysBetween(lastSleep.dayKey, today) <= 1 ? lastSleep.durationMin / 60 : undefined, sleepTargetHours: profile?.sleepTargetHours, recentDiscomfort: Boolean(recentDiscomfort) });
  const latestAssessment = discomfort[0] && daysBetween(discomfort[0].dayKey, today) < 7 ? assessDiscomfort(discomfort[0]) : undefined;
  const weights = body.filter((b) => b.weightKg).map((b) => ({ dayKey: b.dayKey, value: b.weightKg! }));
  const weightTrend = trend(weights, today, 30, profile?.units === 'imperial' ? 'kg' : 'kg');
  const units = profile?.units ?? 'metric';

  const startToday = async () => {
    if (inProgress) return router.push(`/session/${inProgress.id}`);
    const s = sessionFromPlanDay(plan, todayDay ?? upNext?.day, sessions, today);
    await save('workoutSessions', s.id, s);
    router.push(`/session/${s.id}`);
  };

  // A single, rule-based "next best action" grounded in what's actually logged.
  const next = (() => {
    if (latestAssessment && latestAssessment.level !== 'ok' && latestAssessment.level !== 'modify') return { icon: 'medkit-outline' as const, text: latestAssessment.headline, cta: 'View guidance', go: '/recovery/knee' };
    if (inProgress) return { icon: 'play-circle-outline' as const, text: 'You have a workout in progress.', cta: 'Resume', go: `/session/${inProgress.id}` };
    if (!plan) return { icon: 'calendar-outline' as const, text: 'Create your first training plan.', cta: 'Build a plan', go: '/plans/new' };
    if (recoveryOn.enabled && !checkIn) return { icon: 'pulse-outline' as const, text: 'Take a 20-second recovery check-in.', cta: 'Check in', go: '/recovery/check-in' };
    if (todayDay && !doneToday) return { icon: 'barbell-outline' as const, text: `${todayDay.name} is planned for today.`, cta: 'Start', go: '' };
    if (targets && ml < targets.waterMl / 2) return { icon: 'water-outline' as const, text: 'You’re under halfway to your water goal.', cta: 'Log water', go: '/hydration' };
    return { icon: 'leaf-outline' as const, text: 'Nice work. A short mobility routine is a great way to finish the day.', cta: 'Mobility', go: '/mobility' };
  })();

  return (
    <Screen
      title={`${greeting()}, ${profile?.displayName ?? 'there'}`}
      subtitle={profile?.primaryGoal ? `Focus: ${GOAL_LABELS[profile.primaryGoal]}` : 'Let’s make it count today'}
      right={<SyncChip state={sync} />}>
      {config?.settings.maintenance?.active ? <Banner tone="warning" title="Maintenance">{config.settings.maintenance.message}</Banner> : null}
      {config?.settings.announcement ? <Banner tone={config.settings.announcement.level === 'warning' ? 'warning' : 'info'} title={config.settings.announcement.title}>{config.settings.announcement.body}</Banner> : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel="This week">
        {week.map((d) => (
          <View key={d.key} style={{ alignItems: 'center', gap: 6 }}>
            <Text variant="caption" tone="subtle">{d.label}</Text>
            <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: d.isToday ? c.primary : d.trained ? c.surfaceRaised : 'transparent', borderWidth: 1, borderColor: d.trained ? c.accent : c.border }}>
              <Text variant="label" style={{ color: d.isToday ? c.primaryText : c.text }}>{d.date}</Text>
            </View>
          </View>
        ))}
      </View>

      <Card variant="hero">
        <Text variant="overline" tone="primary">{doneToday ? 'Completed today' : todayDay ? 'Today’s workout' : upNext ? (upNext.inDays === 0 ? 'Today' : `Up next · in ${upNext.inDays} day${upNext.inDays > 1 ? 's' : ''}`) : 'Today'}</Text>
        <Text variant="title" style={{ marginTop: 4 }}>{doneToday ? doneToday.name : (todayDay ?? upNext?.day)?.name ?? 'Quick workout'}</Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
          {doneToday
            ? `${completedSetCount(doneToday)} working sets logged`
            : (todayDay ?? upNext?.day)
              ? `${(todayDay ?? upNext!.day).exercises.length} exercises · ~${plan?.sessionMinutes ?? 45} min${(todayDay ?? upNext!.day).focus ? ` · ${(todayDay ?? upNext!.day).focus}` : ''}`
              : plan ? 'Rest day in your plan — or start a quick session.' : 'No plan yet — start a quick session or build a plan.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Button label={inProgress ? 'Resume workout' : doneToday ? 'Train again' : 'Start'} icon="play" testID="home-start" onPress={startToday} style={{ flex: 1 }} />
          {plan ? <Button label="Plan" variant="secondary" onPress={() => router.push(`/plans/${plan.id}`)} /> : <Button label="Build plan" variant="secondary" onPress={() => router.push('/plans/new')} />}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name={next.icon} size={24} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="overline" tone="subtle">Recommended next</Text>
            <Text variant="label">{next.text}</Text>
          </View>
          <Button label={next.cta} size="sm" variant="secondary" onPress={() => (next.go ? router.push(next.go as never) : void startToday())} />
        </View>
      </Card>

      <SectionHeader title="Today" />
      <Row wrap>
        {nutrition.enabled && targets ? (
          <Stat icon="flame-outline" label="Calories" value={`${Math.round(kcal)}`} unit={`/ ${targets.kcal} kcal`} note={todaysMeals.length ? 'From your logs · estimates' : 'Nothing logged yet'} />
        ) : null}
        {nutrition.enabled && targets ? <Stat icon="egg-outline" label="Protein" value={`${Math.round(protein)}`} unit={`/ ${targets.proteinG} g`} note={todaysMeals.length ? 'Logged today' : 'Nothing logged yet'} /> : null}
        <Stat icon="water-outline" label="Water" value={formatVolumeMl(ml, units)} unit={targets ? `/ ${formatVolumeMl(targets.waterMl, units)}` : undefined} note="Logged today" />
        <Stat
          icon="footsteps-outline"
          tone="accent"
          label="Steps"
          value={health?.today?.dayKey === today && health.today.steps !== undefined ? Math.round(health.today.steps).toLocaleString() : '—'}
          note={health?.connected ? (health.today?.dayKey === today ? 'Apple Health · device data' : 'Sync Apple Health to update') : 'Connect Apple Health in More'}
        />
        <Stat icon="moon-outline" label="Last sleep" value={lastSleep ? `${Math.floor(lastSleep.durationMin / 60)}h ${lastSleep.durationMin % 60}m` : '—'} note={lastSleep ? `${lastSleep.source === 'healthkit' ? 'Apple Health' : 'Self-reported'} · ${lastSleep.dayKey}` : 'Log sleep in More → Sleep'} />
      </Row>

      {recoveryOn.enabled ? (
        <Card onPress={() => router.push(checkIn ? '/recovery' : '/recovery/check-in')} accessibilityLabel="Recovery">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: rec.band === 'good' ? c.success : rec.band === 'moderate' ? c.warning : rec.band === 'low' ? c.danger : c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="heading">{rec.score ?? '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">Recovery estimate</Text>
              <Text variant="caption" tone="muted">{rec.score === null ? 'Check in to see today’s estimate.' : rec.explanation}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
          </View>
        </Card>
      ) : null}

      <SectionHeader title="Progress" action="See all" onAction={() => router.push('/progress')} />
      <Row wrap>
        <Stat icon="calendar-outline" label="This week" value={`${cons.weeks[cons.weeks.length - 1]?.sessions ?? 0}`} unit={`/ ${profile?.trainingDays?.length || (plan?.days.length ?? 3)} sessions`} note={`${cons.currentStreakWeeks}-week streak`} />
        <Stat
          icon="scale-outline"
          label="Weight"
          value={weights.length ? formatWeight(weights[weights.length - 1]?.value ?? weights[0]!.value, units).split(' ')[0]! : '—'}
          unit={weights.length ? (units === 'imperial' ? 'lb' : 'kg') : undefined}
          note={weightTrend.change !== undefined ? `${weightTrend.change > 0 ? '+' : ''}${weightTrend.change} kg over ${weightTrend.periodDays} days` : 'Log in My Body'}
        />
      </Row>

      {coach.enabled ? (
        <Card onPress={() => router.push('/coach')} accessibilityLabel="Ask the AI Coach">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="sparkles" size={24} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="label">Ask your AI Coach</Text>
              <Text variant="caption" tone="muted">Plans, swaps, nutrition ideas and recovery questions — using only what you choose to share.</Text>
            </View>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
