import { Linking } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { useConfig } from '@/lib/config';
import { env } from '@/lib/env';
import { confirm } from '@/lib/confirm';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Segmented, ListRow } from '@/components/ui/Controls';

export default function Settings() {
  const { signOut, user } = useAuth();
  const { profile, save } = useProfile();
  const { config } = useConfig();
  return (
    <Screen title="Settings" back>
      <Card style={{ gap: 12 }}>
        <Text variant="label">Appearance</Text>
        <Segmented options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} value={profile?.theme ?? 'dark'} onChange={(v) => save({ theme: v })} />
        <Text variant="label">Units</Text>
        <Segmented options={[{ value: 'metric', label: 'Metric' }, { value: 'imperial', label: 'Imperial' }]} value={profile?.units ?? 'metric'} onChange={(v) => save({ units: v })} />
      </Card>
      <Card>
        <ListRow icon="person-outline" title="Profile & goals" subtitle="Training, nutrition and body details" onPress={() => router.push('/settings/profile')} />
        <ListRow icon="shield-checkmark-outline" title="Privacy & data" subtitle="AI sharing, export and deletion" onPress={() => router.push('/settings/privacy')} />
        <ListRow icon="notifications-outline" title="Notifications" subtitle="Reminders you choose" onPress={() => router.push('/settings/notifications')} />
        <ListRow icon="heart-outline" title="Health sync" subtitle="Apple Health" onPress={() => router.push('/health-sync')} />
      </Card>
      <Card>
        <ListRow icon="card-outline" title="Plan" subtitle={config ? `${config.entitlement.planName} · ${config.entitlement.billing === 'test_mode' ? 'test mode — no payments are processed' : config.entitlement.status}` : 'Loading…'} />
        {config?.settings.supportEmail ? <ListRow icon="mail-outline" title="Contact support" subtitle={config.settings.supportEmail} onPress={() => Linking.openURL(`mailto:${config.settings.supportEmail}`)} /> : null}
        {env.privacyPolicyUrl ? <ListRow icon="document-outline" title="Privacy Policy" onPress={() => Linking.openURL(env.privacyPolicyUrl)} /> : null}
        {env.termsUrl ? <ListRow icon="document-outline" title="Terms" onPress={() => Linking.openURL(env.termsUrl)} /> : null}
      </Card>
      <Card>
        <ListRow icon="log-out-outline" title="Sign out" subtitle={user?.email ?? undefined} tone="danger" testID="sign-out" onPress={async () => (await confirm('Sign out?', 'Unsynced changes stay on this device and sync when you sign back in.', 'Sign out')) && signOut()} />
      </Card>
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>FORMA 0.1.0 · Fitness & wellness guidance, not medical advice.</Text>
    </Screen>
  );
}
