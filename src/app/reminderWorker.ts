import { currentStreak, localDay } from '../lib/streak';
import { reminderMessage, shouldRemind, REMINDER_TAG, type ReminderSettings } from '../lib/reminder';

/** What the service worker gives the reminder logic: the data, the permission and the way to show a notification. */
export interface ReminderDeps {
  now(): Date;
  loadReminder(): Promise<ReminderSettings>;
  listStudyDays(): Promise<string[]>;
  permission(): NotificationPermission;
  show(title: string, options: NotificationOptions): Promise<void>;
  saveLastSent(day: string, reminder: ReminderSettings): Promise<void>;
}

/**
 * Called when the browser wakes the service worker (periodic background sync). Shows the daily reminder when it is due;
 * returns whether it did. Never throws: a failed attempt is simply tried again at the next wake-up, because the day is only
 * marked as sent after the notification was shown.
 */
export async function remindIfNeeded(deps: ReminderDeps): Promise<boolean> {
  try {
    const [reminder, days] = await Promise.all([deps.loadReminder(), deps.listStudyDays()]);
    const now = deps.now();
    const today = localDay(now.getTime());
    if (!shouldRemind({ now, reminder, studiedToday: days.includes(today) })) return false;
    if (deps.permission() !== 'granted') return false;
    const { title, body } = reminderMessage(currentStreak(days, today));
    await deps.show(title, { body, tag: REMINDER_TAG, icon: 'pwa-192x192.png', badge: 'pwa-64x64.png' });
    await deps.saveLastSent(today, reminder);
    return true;
  } catch {
    return false;
  }
}
