import { View } from 'react-native';
import { formatVolumeMl, lastNDays, mlToFloz, type HydrationLog } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { newId, nowIso } from '@/lib/ids';
import { useTargets, useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Banner, SectionHeader } from '@/components/ui/Feedback';
import { ListRow } from '@/components/ui/Controls';
import { BarChart, ProgressRing } from '@/components/charts/Charts';

export default function Hydration() {
  const today = useToday();
  const { profile } = useProfile();
  const units = profile?.units ?? 'metric';
  const { data: targets } = useTargets();
  const { items } = useCollection<HydrationLog>('hydrationLogs', { orderBy: 'dayKey', limit: 300 });
  const { save, remove } = useMutations();
  const feature = useFeature('hydration');
  const target = targets?.waterMl ?? 2000;
  const todays = items.filter((i) => i.dayKey === today);
  const total = todays.reduce((s, i) => s + i.ml, 0);
  const add = (ml: number) => {
    const id = newId();
    return save('hydrationLogs', id, { id, dayKey: today, ml, at: nowIso(), createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
  };
  const servings = units === 'imperial' ? [237, 355, 473, 710] : [250, 500, 750, 1000];
  const week = lastNDays(today, 7).map((d) => ({ x: d.slice(8), y: Math.round(items.filter((i) => i.dayKey === d).reduce((s, i) => s + i.ml, 0) / (units === 'imperial' ? 29.57 : 1)) }));
  if (!feature.enabled) return <Screen title="Hydration" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Water intake" back>
      <Card style={{ alignItems: 'center', gap: 16 }}>
        <ProgressRing value={total} max={target} size={180} label={formatVolumeMl(total, units)} sublabel={`of ${formatVolumeMl(target, units)}`} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
          {servings.map((ml) => <Button key={ml} label={`+ ${formatVolumeMl(ml, units)}`} testID={`water-${ml}`} variant="secondary" size="sm" onPress={() => add(ml)} />)}
        </View>
      </Card>
      <Text variant="caption" tone="subtle">Your target is adjustable general guidance (Nutrition → Targets), not a medical requirement. Needs vary with climate, activity and health — follow any advice from your clinician.</Text>
      <Card>
        <Text variant="label">Last 7 days ({units === 'imperial' ? 'fl oz' : 'ml'})</Text>
        <BarChart data={week} target={units === 'imperial' ? Math.round(mlToFloz(target)) : target} />
      </Card>
      <SectionHeader title="Today’s log" />
      <Card>
        {todays.length ? todays.map((i) => (
          <ListRow key={i.id} icon="water" title={formatVolumeMl(i.ml, units)} subtitle={new Date(i.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} right={<IconButton icon="trash-outline" label="Remove" tone="danger" onPress={() => remove('hydrationLogs', i.id)} />} />
        )) : <Text variant="caption" tone="muted">No water logged yet today.</Text>}
      </Card>
      <ListRow icon="notifications-outline" title="Hydration reminders" subtitle="Settings → Notifications" />
    </Screen>
  );
}
