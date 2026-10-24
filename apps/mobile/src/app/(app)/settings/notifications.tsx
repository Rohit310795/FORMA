import { useState } from 'react';
import { REMINDER_CATEGORIES, type NotificationPreferences } from '@forma/shared';
import { useMutations, useUserDoc } from '@/lib/data';
import { useConfig, useFeature } from '@/lib/config';
import { applyReminders, defaultTime, notificationsSupported, requestPermission, type ReminderCategory } from '@/lib/notifications';
import { nowIso } from '@/lib/ids';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Field, Toggle } from '@/components/ui/Controls';
import { Banner } from '@/components/ui/Feedback';

const LABELS: Record<ReminderCategory, string> = { workouts: 'Scheduled workouts', hydration: 'Hydration', sleep: 'Wind-down / sleep', recovery: 'Recovery check-in', milestones: 'Progress milestones', habits: 'Habits & routines' };

export default function Notifications() {
  const feature = useFeature('notifications');
  const { config } = useConfig();
  const { data } = useUserDoc<NotificationPreferences>('settings', 'notifications');
  const { save } = useMutations();
  const prefs: NotificationPreferences = data ?? { permission: 'undetermined', categories: {}, showDetailsOnLockScreen: false, updatedAt: '' };
  const [msg, setMsg] = useState<string>();

  const update = async (patch: Partial<NotificationPreferences>) => {
    const next = { ...prefs, ...patch, updatedAt: nowIso() };
    await save('settings', 'notifications', next);
    if (next.permission === 'granted') await applyReminders(next as never, config?.settings.notificationTemplates);
  };
  const enable = async () => {
    const permission = await requestPermission();
    await update({ permission });
    setMsg(permission === 'granted' ? 'Notifications enabled.' : 'Permission not granted. You can change this in your device settings.');
  };

  if (!feature.enabled) return <Screen title="Notifications" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Notifications" back>
      {!notificationsSupported ? <Banner tone="info">Reminders are available in the iOS and Android apps.</Banner> : null}
      {prefs.permission !== 'granted' && notificationsSupported ? (
        <Card style={{ gap: 8 }}>
          <Text variant="label">Reminders are optional</Text>
          <Text variant="caption" tone="muted">FORMA only asks for permission when you choose. Reminders are scheduled on your device.</Text>
          <Button label="Allow notifications" onPress={enable} />
        </Card>
      ) : null}
      <Card style={{ gap: 6 }}>
        {REMINDER_CATEGORIES.map((cat) => {
          const cfg = prefs.categories[cat] ?? { enabled: false };
          return (
            <Card key={cat} variant="outline" style={{ gap: 6 }}>
              <Toggle label={LABELS[cat]} value={cfg.enabled} onChange={(v) => update({ categories: { ...prefs.categories, [cat]: { ...cfg, enabled: v, time: cfg.time ?? defaultTime(cat) } } })} />
              {cfg.enabled ? <Field label="Time (24h)" value={cfg.time ?? defaultTime(cat)} onChangeText={(t) => /^\d{2}:\d{2}$/.test(t) && update({ categories: { ...prefs.categories, [cat]: { ...cfg, time: t } } })} /> : null}
            </Card>
          );
        })}
      </Card>
      <Card>
        <Toggle label="Show details on the lock screen" description="Off by default so health information isn’t visible to others." value={prefs.showDetailsOnLockScreen} onChange={(v) => update({ showDetailsOnLockScreen: v })} />
      </Card>
      {msg ? <Text variant="caption" tone="muted">{msg}</Text> : null}
    </Screen>
  );
}
