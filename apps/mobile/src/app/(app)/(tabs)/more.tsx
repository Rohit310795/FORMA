import { router } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';
import type { FeatureKey } from '@forma/shared';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { useConfig } from '@/lib/config';
import { FEATURES } from '@forma/shared';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/Controls';
import { Badge, SectionHeader } from '@/components/ui/Feedback';
import { Text } from '@/components/ui/Text';

type Item = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; go: string; feature?: FeatureKey };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'You',
    items: [
      { icon: 'body-outline', title: 'My body', subtitle: 'Measurements, goals and photos', go: '/body' },
      { icon: 'stats-chart-outline', title: 'Progress', subtitle: 'Consistency, strength and trends', go: '/progress' },
      { icon: 'fitness-outline', title: 'My muscles', subtitle: 'Muscle map and priorities', go: '/muscles' },
    ],
  },
  {
    title: 'Recovery',
    items: [
      { icon: 'pulse-outline', title: 'Recovery & joint health', subtitle: 'Check-ins and estimate', go: '/recovery', feature: 'recovery' },
      { icon: 'walk-outline', title: 'Knee health', subtitle: 'Discomfort log, exercises, guidance', go: '/recovery/knee', feature: 'kneeHealth' },
      { icon: 'leaf-outline', title: 'Mobility', subtitle: 'Warm-ups, cooldowns and routines', go: '/mobility', feature: 'mobility' },
      { icon: 'document-text-outline', title: 'Clinician instructions', subtitle: 'Advice from your doctor or physio', go: '/clinician' },
    ],
  },
  {
    title: 'Wellness',
    items: [
      { icon: 'moon-outline', title: 'Sleep', subtitle: 'Logs, trends and tips', go: '/sleep', feature: 'sleep' },
      { icon: 'water-outline', title: 'Hydration', subtitle: 'Water intake and targets', go: '/hydration', feature: 'hydration' },
      { icon: 'sparkles-outline', title: 'Skincare & Glow', subtitle: 'Routines and habits', go: '/glow', feature: 'skincare' },
      { icon: 'flask-outline', title: 'Supplements', subtitle: 'Inventory and evidence', go: '/supplements', feature: 'supplements' },
    ],
  },
  {
    title: 'App',
    items: [
      { icon: 'heart-outline', title: 'Health sync', subtitle: 'Apple Health', go: '/health-sync', feature: 'appleHealthSync' },
      { icon: 'settings-outline', title: 'Settings', subtitle: 'Profile, privacy, notifications', go: '/settings' },
    ],
  },
];

export default function More() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { config } = useConfig();
  return (
    <Screen title="More">
      <Card onPress={() => router.push('/settings/profile')} accessibilityLabel="Edit profile">
        <Text variant="heading">{profile?.displayName}</Text>
        <Text variant="caption" tone="muted">{user?.email}</Text>
        {config ? <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>{config.entitlement.planName} plan{config.entitlement.billing === 'test_mode' ? ' · test mode' : ''}</Text> : null}
      </Card>
      {GROUPS.map((g) => (
        <Card key={g.title}>
          <SectionHeader title={g.title} />
          {g.items.map((i) => {
            const decision = i.feature ? config?.features?.[i.feature] : undefined;
            const off = decision ? !decision.enabled : false;
            return (
              <ListRow
                key={i.title}
                icon={i.icon}
                title={i.title}
                subtitle={off ? decision?.message ?? FEATURES[i.feature!].disabledMessage : i.subtitle}
                right={off ? <Badge label="Off" /> : undefined}
                onPress={() => router.push(i.go as never)}
              />
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
