/**
 * Apple Health is only available through HealthKit on iOS development or
 * production builds. Web, Android and Expo Go use this stub.
 */
export interface HealthSnapshot {
  steps?: number;
  activeEnergyKcal?: number;
  restingHeartRate?: number;
  sleep: { dayKey: string; durationMin: number; stages: { deep?: number; core?: number; rem?: number; awake?: number }; externalId: string }[];
  workouts: { externalId: string; startDate: string; endDate: string; activityType: string; energyKcal?: number; durationMin: number }[];
}

export const HEALTH_TYPES = ['Steps', 'Active energy', 'Resting heart rate', 'Sleep', 'Workouts'] as const;

export async function healthKitAvailability(): Promise<{ available: boolean; reason?: string }> {
  return { available: false, reason: 'Apple Health is available in the FORMA iOS app (development or App Store build). It isn’t available on the web, Android or in Expo Go.' };
}

export async function requestHealthKitAccess(): Promise<boolean> {
  return false;
}

export async function readHealthSnapshot(_since: Date): Promise<HealthSnapshot> {
  return { sleep: [], workouts: [] };
}
