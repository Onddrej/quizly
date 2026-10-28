/**
 * The daily reminder, pure part: when to remind and what to say. The browser side (permission, periodic sync, showing
 * the notification) is in reminderSetup.ts and in the service worker (sw.ts).
 */
import { localDay } from './streak';

/** The name the periodic background sync is registered under. */
export const REMINDER_TAG = 'daily-reminder';

export interface ReminderSettings {
  enabled: boolean;
  /** Local time of day, `HH:MM`. */
  time: string;
  /** The local day on which a reminder was last shown, so there is at most one a day. */
  lastSentDay?: string;
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(time: string): boolean {
  return TIME.test(time);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * The browser wakes the service worker at times of its own choosing (periodic background sync), so "at 19:30" can only
 * mean "the first wake-up after 19:30". Remind then, if the reminder is on, nothing was completed today and no reminder
 * was shown today.
 */
export function shouldRemind(state: { now: Date; reminder: ReminderSettings; studiedToday: boolean }): boolean {
  const { now, reminder, studiedToday } = state;
  if (!reminder.enabled || studiedToday || !isValidTime(reminder.time)) return false;
  if (reminder.lastSentDay === localDay(now.getTime())) return false;
  return now.getHours() * 60 + now.getMinutes() >= timeToMinutes(reminder.time);
}

export function reminderMessage(streak: number): { title: string; body: string } {
  const body = streak > 0 ? `Finish a round today to keep your ${streak}-day streak.` : 'Finish a round today to start a streak.';
  return { title: 'Time to learn', body };
}
