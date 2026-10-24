import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { HEALTH_TYPES, healthKitAvailability, readHealthSnapshot, requestHealthKitAccess } from '@/lib/healthkit';
import { addDays, type HealthSyncMetadata, type SleepLog, type WorkoutSession } from '@forma/shared';
import { useCollection, useMutations, useUserDoc } from '@/lib/data';
import { useFeature } from '@/lib/config';
import { nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/Controls';
import { Banner, Badge } from '@/components/ui/Feedback';
import { confirm } from '@/lib/confirm';

type Meta = HealthSyncMetadata & { today?: { dayKey: string; steps?: number; activeEnergyKcal?: number; restingHeartRate?: number } };

export default function HealthSync() {
  const feature = useFeature('appleHealthSync');
  const today = useToday();
  const { data: meta } = useUserDoc<Meta>('settings', 'healthSync');
  const { items: sessions } = useCollection<WorkoutSession>('workoutSessions', { orderBy: 'startedAt', limit: 300 });
  const { items: sleep } = useCollection<SleepLog>('sleepLogs', { orderBy: 'dayKey', limit: 60 });
  const { save, remove } = useMutations();
  const [avail, setAvail] = useState<{ available: boolean; reason?: string }>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  useEffect(() => void healthKitAvailability().then(setAvail), []);

  const writeMeta = (patch: Partial<Meta>) => save('settings', 'healthSync', { provider: 'healthkit', connected: false, grantedTypes: [], lastSyncStatus: 'never', anchors: {}, ...meta, ...patch, updatedAt: nowIso() });

  const sync = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      const since = new Date(Date.now() - 14 * 86_400_000);
      const snap = await readHealthSnapshot(since);
      // De-duplicate: imported records use stable ids derived from HealthKit identifiers.
      const knownWorkouts = new Set(sessions.map((s) => s.externalId).filter(Boolean));
      let added = 0;
      for (const w of snap.workouts) {
        if (knownWorkouts.has(w.externalId)) continue;
        const id = `hk${w.externalId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)}`;
        await save('workoutSessions', id, { id, dayKey: w.startDate.slice(0, 10), name: `Apple Health workout`, status: 'completed', startedAt: w.startDate, endedAt: w.endDate, pausedMs: 0, exercises: [], externalId: w.externalId, activityType: w.activityType, energyKcal: w.energyKcal, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'healthkit' });
        added++;
      }
      for (const n of snap.sleep) {
        const id = `hk${n.dayKey.replace(/-/g, '')}`;
        const manual = sleep.find((s) => s.dayKey === n.dayKey && s.source === 'manual');
        if (manual) continue; // never overwrite what the user typed in
        await save('sleepLogs', id, { id, dayKey: n.dayKey, durationMin: n.durationMin, stages: n.stages, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'healthkit' });
      }
      const partial = snap.steps === undefined && !snap.sleep.length && !snap.workouts.length;
      await writeMeta({ connected: true, lastSyncAt: nowIso(), lastSyncStatus: partial ? 'partial' : 'ok', today: { dayKey: today, steps: snap.steps, activeEnergyKcal: snap.activeEnergyKcal, restingHeartRate: snap.restingHeartRate } });
      setMsg(partial ? 'Synced, but no data was returned. Check permissions in the Health app (Profile → Apps → FORMA).' : `Synced. ${added} new workout${added === 1 ? '' : 's'} imported.`);
    } catch {
      await writeMeta({ lastSyncStatus: 'error', lastError: 'Sync failed' });
      setMsg('Sync failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      await requestHealthKitAccess();
      await writeMeta({ connected: true, grantedTypes: [...HEALTH_TYPES] });
      setBusy(false);
      await sync();
    } catch {
      setMsg('Couldn’t connect to Apple Health.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!(await confirm('Disconnect Apple Health?', 'FORMA will stop reading new data. Choose whether to also delete data already imported.', 'Disconnect'))) return;
    const purge = await confirm('Delete imported data?', 'Remove workouts and sleep imported from Apple Health? Data you entered yourself is kept.', 'Delete imported');
    if (purge) {
      for (const s of sessions.filter((x) => x.source === 'healthkit')) await remove('workoutSessions', s.id);
      for (const s of sleep.filter((x) => x.source === 'healthkit')) await remove('sleepLogs', s.id);
    }
    await writeMeta({ connected: false, grantedTypes: [], today: undefined });
    setMsg('Disconnected. To fully revoke access, open the Health app → Profile → Apps → FORMA and turn off all categories.');
  };

  if (!feature.enabled) return <Screen title="Health sync" back><Banner tone="info">{feature.message}</Banner></Screen>;
  return (
    <Screen title="Health sync" subtitle="Apple Health (HealthKit)" back>
      {avail && !avail.available ? <Banner tone="info" title="Not available here">{avail.reason ?? ''}</Banner> : null}
      <Card style={{ gap: 10 }}>
        <Text variant="heading">{meta?.connected ? 'Connected to Apple Health' : 'Connect Apple Health'}</Text>
        <Text variant="caption" tone="muted">Read-only. FORMA requests only: {HEALTH_TYPES.join(', ')}. Imported data is labelled as device data and is never used to infer a medical condition.</Text>
        {meta?.lastSyncAt ? <Text variant="caption" tone="subtle">Last sync: {new Date(meta.lastSyncAt).toLocaleString()} · <Badge label={meta.lastSyncStatus} tone={meta.lastSyncStatus === 'ok' ? 'success' : meta.lastSyncStatus === 'error' ? 'danger' : 'warning'} /></Text> : null}
        {meta?.today?.dayKey === today ? (
          <Text variant="caption">Today: {meta.today.steps !== undefined ? `${Math.round(meta.today.steps).toLocaleString()} steps` : 'steps unavailable'} · {meta.today.activeEnergyKcal !== undefined ? `${Math.round(meta.today.activeEnergyKcal)} active kcal` : 'energy unavailable'}{meta.today.restingHeartRate ? ` · resting HR ${Math.round(meta.today.restingHeartRate)} bpm` : ''}</Text>
        ) : null}
        {avail?.available ? (
          meta?.connected ? (
            <>
              <Button label="Sync now" icon="sync" onPress={sync} loading={busy} />
              <Button label="Disconnect" variant="danger" onPress={disconnect} />
            </>
          ) : (
            <Button label="Connect Apple Health" icon="heart" onPress={connect} loading={busy} />
          )
        ) : meta?.connected ? <Button label="Disconnect" variant="danger" onPress={disconnect} /> : null}
        {msg ? <Text variant="caption" tone="muted">{msg}</Text> : null}
      </Card>
      <Card>
        {HEALTH_TYPES.map((t) => <ListRow key={t} icon="checkmark-circle-outline" title={t} subtitle={meta?.connected ? 'Requested' : 'Not connected'} />)}
      </Card>
      <Text variant="caption" tone="subtle">{Platform.OS === 'ios' ? 'HealthKit never tells apps whether read access was denied, so missing categories simply show as unavailable.' : 'Health Connect (Android) isn’t supported yet.'} Imported days from {addDays(today, -14)} onward.</Text>
    </Screen>
  );
}
