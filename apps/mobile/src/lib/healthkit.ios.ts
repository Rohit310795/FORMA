import Constants from 'expo-constants';
import type { HealthSnapshot } from './healthkit';

export type { HealthSnapshot } from './healthkit';
export { HEALTH_TYPES } from './healthkit';

const READ = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

// HealthKit sleep analysis values (Apple): 0 inBed, 1 asleepUnspecified, 2 awake, 3 core, 4 deep, 5 REM.
const ASLEEP = new Set([1, 3, 4, 5]);

const isExpoGo = () => Constants.executionEnvironment === 'storeClient';

async function hk() {
  // Loaded lazily so a missing native module (e.g. Expo Go) degrades gracefully instead of crashing.
  return import('@kingstinct/react-native-healthkit');
}

export async function healthKitAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (isExpoGo()) return { available: false, reason: 'Apple Health needs a FORMA development or App Store build — it doesn’t work in Expo Go.' };
  try {
    const mod = await hk();
    return mod.isHealthDataAvailable() ? { available: true } : { available: false, reason: 'Health data isn’t available on this device.' };
  } catch {
    return { available: false, reason: 'The HealthKit module isn’t included in this build.' };
  }
}

/** Requests read-only access. HealthKit never reveals whether read access was denied, so we handle empty data. */
export async function requestHealthKitAccess(): Promise<boolean> {
  const mod = await hk();
  return mod.requestAuthorization({ toRead: READ as never });
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function readHealthSnapshot(since: Date): Promise<HealthSnapshot> {
  const mod = await hk();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filter = { date: { startDate: today, endDate: new Date() } };
  const safe = async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      return undefined; // missing permission or no data → treat as absent, never as zero
    }
  };
  const steps = await safe(() => mod.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter, unit: 'count' } as never));
  const energy = await safe(() => mod.queryStatisticsForQuantity('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], { filter, unit: 'kcal' } as never));
  const rhr = await safe(() => mod.queryStatisticsForQuantity('HKQuantityTypeIdentifierRestingHeartRate', ['mostRecent'], { filter: { date: { startDate: since, endDate: new Date() } }, unit: 'count/min' } as never));

  const sleepSamples = (await safe(() => mod.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter: { date: { startDate: since, endDate: new Date() } } } as never))) ?? [];
  const nights = new Map<string, { durationMin: number; stages: Record<string, number>; ids: string[] }>();
  for (const s of sleepSamples as readonly { uuid: string; startDate: Date; endDate: Date; value: number }[]) {
    const minutes = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
    const key = localDay(new Date(s.endDate));
    const n = nights.get(key) ?? { durationMin: 0, stages: {}, ids: [] };
    if (ASLEEP.has(s.value)) n.durationMin += minutes;
    const stage = s.value === 4 ? 'deep' : s.value === 3 ? 'core' : s.value === 5 ? 'rem' : s.value === 2 ? 'awake' : undefined;
    if (stage) n.stages[stage] = (n.stages[stage] ?? 0) + minutes;
    n.ids.push(s.uuid);
    nights.set(key, n);
  }

  const workouts = (await safe(() => mod.queryWorkoutSamples({ limit: 50, filter: { date: { startDate: since, endDate: new Date() } } } as never))) ?? [];
  return {
    steps: steps?.sumQuantity?.quantity,
    activeEnergyKcal: energy?.sumQuantity?.quantity,
    restingHeartRate: rhr?.mostRecentQuantity?.quantity,
    sleep: [...nights.entries()]
      .filter(([, n]) => n.durationMin > 0)
      .map(([dayKey, n]) => ({ dayKey, durationMin: Math.round(n.durationMin), stages: n.stages, externalId: `hk-sleep-${dayKey}` })),
    workouts: (workouts as readonly { uuid: string; startDate: Date; endDate: Date; workoutActivityType: number; duration?: { quantity: number } }[]).map((w) => ({
      externalId: w.uuid,
      startDate: new Date(w.startDate).toISOString(),
      endDate: new Date(w.endDate).toISOString(),
      activityType: `HK activity ${w.workoutActivityType}`,
      durationMin: Math.round((new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 60000),
    })),
  };
}
