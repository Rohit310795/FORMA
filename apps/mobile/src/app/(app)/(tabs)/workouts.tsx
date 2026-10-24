import { View } from 'react-native';
import { router } from 'expo-router';
import { WEEKDAYS, sessionDurationMin, sessionVolumeKg, formatWeight, isoWeekday } from '@forma/shared';
import { useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useTheme } from '@/lib/theme';
import { useActivePlan, useSessions, useToday, sessionFromPlanDay } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, SectionHeader, Badge } from '@/components/ui/Feedback';
import { ListRow, ListRow as Row } from '@/components/ui/Controls';

export default function Workouts() {
  const { c } = useTheme();
  const today = useToday();
  const { profile } = useProfile();
  const { plan, plans } = useActivePlan();
  const { items: sessions } = useSessions();
  const { save } = useMutations();
  const recent = sessions.filter((s) => s.status === 'completed').slice(0, 8);
  const inProgress = sessions.find((s) => s.status === 'in_progress' || s.status === 'paused');

  const start = async (dayKey?: string) => {
    if (inProgress) return router.push(`/session/${inProgress.id}`);
    const day = plan?.days.find((d) => d.key === dayKey);
    const s = sessionFromPlanDay(plan, day, sessions, today);
    await save('workoutSessions', s.id, s);
    router.push(`/session/${s.id}`);
  };

  return (
    <Screen title="Workouts" subtitle={plan ? plan.name : 'Plans, library and history'} right={<Button label="New plan" size="sm" icon="add" onPress={() => router.push('/plans/new')} />}>
      {inProgress ? (
        <Card variant="hero" onPress={() => router.push(`/session/${inProgress.id}`)}>
          <Text variant="overline" tone="primary">In progress</Text>
          <Text variant="heading">{inProgress.name}</Text>
          <Text variant="caption" tone="muted">Tap to resume</Text>
        </Card>
      ) : null}

      {plan ? (
        <>
          <SectionHeader title="Weekly plan" action="Edit" onAction={() => router.push(`/plans/${plan.id}`)} />
          <Card>
            {WEEKDAYS.map((d) => {
              const day = plan.days.find((x) => x.weekday === d.iso);
              const isToday = isoWeekday(today) === d.iso;
              return (
                <View key={d.iso} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: d.iso < 7 ? 1 : 0, borderColor: c.border }}>
                  <View style={{ width: 44, alignItems: 'center' }}>
                    <Text variant="label" tone={isToday ? 'primary' : 'muted'}>{d.short}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="label">{day ? day.name : 'Rest / mobility'}</Text>
                    <Text variant="caption" tone="muted">{day ? `${day.exercises.length} exercises${day.focus ? ` · ${day.focus}` : ''}` : 'Recovery, walking or stretching'}</Text>
                  </View>
                  {day ? <Button label="Start" size="sm" variant={isToday ? 'primary' : 'secondary'} onPress={() => start(day.key)} /> : <Button label="Mobility" size="sm" variant="ghost" onPress={() => router.push('/mobility')} />}
                </View>
              );
            })}
          </Card>
          {plan.days.some((d) => !d.weekday) ? (
            <Card>
              <Text variant="label">Unscheduled days</Text>
              {plan.days.filter((d) => !d.weekday).map((d) => (
                <Row key={d.key} title={d.name} subtitle={`${d.exercises.length} exercises`} onPress={() => start(d.key)} />
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <EmptyState icon="calendar-outline" title="No plan yet" message="Pick a template (Push/Pull/Legs, Upper/Lower, Full Body, Home…) or ask the AI to draft one. You can edit everything." actionLabel="Build a plan" onAction={() => router.push('/plans/new')} />
          <Button label="Start an empty workout" variant="ghost" onPress={() => start()} />
        </Card>
      )}

      <SectionHeader title="Explore" />
      <Card>
        <ListRow icon="library-outline" title="Exercise library" subtitle="Search by muscle, equipment and difficulty" onPress={() => router.push('/exercises')} />
        <ListRow icon="body-outline" title="My muscles" subtitle="Muscle map, recent volume and priorities" onPress={() => router.push('/muscles')} />
        <ListRow icon="ellipse-outline" title="Abs & core" subtitle="Anti-extension, anti-rotation and stability" onPress={() => router.push('/exercises?type=core')} />
        <ListRow icon="leaf-outline" title="Warm-ups, cooldowns & mobility" onPress={() => router.push('/mobility')} />
        <ListRow icon="water-outline" title="Low-impact cardio & swimming" onPress={() => router.push('/exercises?type=cardio')} />
      </Card>

      {plans.length > 1 ? (
        <>
          <SectionHeader title="Your plans" />
          <Card>
            {plans.map((p) => (
              <Row key={p.id} title={p.name} subtitle={`${p.days.length} days · v${p.version}`} right={p.active ? <Badge label="Active" tone="primary" /> : undefined} onPress={() => router.push(`/plans/${p.id}`)} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="History" action={recent.length ? 'Progress' : undefined} onAction={() => router.push('/progress')} />
      {recent.length ? (
        <Card>
          {recent.map((s) => (
            <Row
              key={s.id}
              title={s.name}
              subtitle={`${s.dayKey} · ${sessionDurationMin(s) ?? '–'} min · ${formatWeight(sessionVolumeKg(s), profile?.units ?? 'metric', 0)} volume${s._pending ? ' · waiting to sync' : ''}`}
              onPress={() => router.push(`/session/summary/${s.id}`)}
            />
          ))}
        </Card>
      ) : (
        <Text variant="caption" tone="muted">Completed workouts will appear here.</Text>
      )}
    </Screen>
  );
}
