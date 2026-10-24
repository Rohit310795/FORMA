import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { MOBILITY_ROUTINES, type MobilitySession } from '@forma/shared';
import { useCollection } from '@/lib/data';
import { useFeature } from '@/lib/config';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { ChipGroup } from '@/components/ui/Controls';
import { Badge, Banner } from '@/components/ui/Feedback';

export default function Mobility() {
  const feature = useFeature('mobility');
  const [kind, setKind] = useState('all');
  const { items: sessions } = useCollection<MobilitySession>('mobilitySessions', { orderBy: 'dayKey', limit: 30 });
  if (!feature.enabled) return <Screen title="Mobility" back><Banner tone="info">{feature.message}</Banner></Screen>;
  const list = MOBILITY_ROUTINES.filter((r) => kind === 'all' || r.kind === kind || (kind === 'knee' && r.kneeFriendly));
  return (
    <Screen title="Flexibility & mobility" subtitle={sessions.length ? `${sessions.length} sessions logged recently` : 'Warm-ups, cooldowns and routines'} back>
      <ChipGroup scroll options={[{ value: 'all', label: 'All' }, { value: 'warmup', label: 'Warm-up' }, { value: 'cooldown', label: 'Cooldown' }, { value: 'mobility', label: 'Mobility' }, { value: 'flexibility', label: 'Flexibility' }, { value: 'knee', label: 'Knee-friendly' }]} value={kind} onChange={(v) => setKind(v as string)} />
      {list.map((r) => (
        <Card key={r.id} onPress={() => router.push(`/mobility/${r.id}`)} accessibilityLabel={r.name}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">{r.name}</Text>
              <Text variant="caption" tone="muted">{r.minutes} min · {r.steps.length} moves · {r.description}</Text>
            </View>
            {r.kneeFriendly ? <Badge label="Knee-friendly" tone="success" /> : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
