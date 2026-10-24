import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type ReminderCategory = 'workouts' | 'hydration' | 'sleep' | 'recovery' | 'milestones' | 'habits';

/** Generic lock-screen copy: no health details unless the user opts in. */
const GENERIC: Record<ReminderCategory, { title: string; body: string }> = {
  workouts: { title: 'FORMA', body: 'Time for your planned session.' },
  hydration: { title: 'FORMA', body: 'A quick reminder from FORMA.' },
  sleep: { title: 'FORMA', body: 'Your wind-down reminder.' },
  recovery: { title: 'FORMA', body: 'How are you feeling today? Take a 20-second check-in.' },
  milestones: { title: 'FORMA', body: 'You have an update in FORMA.' },
  habits: { title: 'FORMA', body: 'A gentle nudge for your routine.' },
};
const DETAILED: Record<ReminderCategory, { title: string; body: string }> = {
  workouts: { title: 'Workout time', body: 'Your planned workout is ready when you are.' },
  hydration: { title: 'Hydration', body: 'Have a glass of water and log it.' },
  sleep: { title: 'Wind down', body: 'Screens away — time to start your wind-down routine.' },
  recovery: { title: 'Recovery check-in', body: 'Log sleep, soreness and energy in 20 seconds.' },
  milestones: { title: 'Milestone', body: 'Check your progress in FORMA.' },
  habits: { title: 'Habits', body: 'Time for your routine.' },
};

export const notificationsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export async function requestPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!notificationsSupported) return 'denied';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  const res = await Notifications.requestPermissionsAsync();
  return res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied';
}

/** Replaces all FORMA reminders with the current preferences. Local only — nothing is sent to a server. */
export async function applyReminders(prefs: { categories: Partial<Record<ReminderCategory, { enabled: boolean; time?: string }>>; showDetailsOnLockScreen: boolean }, templates?: Partial<Record<string, { title: string; body: string }>>) {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const [cat, cfg] of Object.entries(prefs.categories) as [ReminderCategory, { enabled: boolean; time?: string }][]) {
    if (!cfg?.enabled) continue;
    const [h, m] = (cfg.time ?? defaultTime(cat)).split(':').map(Number);
    const content = prefs.showDetailsOnLockScreen ? (templates?.[cat] ?? DETAILED[cat]) : GENERIC[cat];
    await Notifications.scheduleNotificationAsync({
      content: { title: content.title, body: content.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h ?? 9, minute: m ?? 0 },
    });
  }
}

export function defaultTime(cat: ReminderCategory) {
  return { workouts: '18:00', hydration: '11:00', sleep: '22:00', recovery: '08:30', milestones: '19:00', habits: '07:30' }[cat];
}
