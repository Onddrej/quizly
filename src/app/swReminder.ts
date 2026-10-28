import { loadSettings, saveSetting } from '../db/settings';
import { listStudyDays } from '../db/studyLog';
import { REMINDER_TAG } from '../lib/reminder';
import { remindIfNeeded, type ReminderDeps } from './reminderWorker';

/** The parts of the service worker scope the reminder uses; the tsconfig has the DOM lib, not the WebWorker one. */
interface ExtendableEventLike {
  waitUntil(promise: Promise<unknown>): void;
}
interface PeriodicSyncEventLike extends ExtendableEventLike {
  tag: string;
}
interface NotificationClickEventLike extends ExtendableEventLike {
  notification: { close(): void };
}
export interface ReminderScope {
  registration: { scope: string; showNotification(title: string, options?: NotificationOptions): Promise<void> };
  clients: {
    matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<Array<{ focus(): Promise<unknown> }>>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(type: 'periodicsync', listener: (event: PeriodicSyncEventLike) => void): void;
  addEventListener(type: 'notificationclick', listener: (event: NotificationClickEventLike) => void): void;
}

function reminderDeps(scope: ReminderScope): ReminderDeps {
  return {
    now: () => new Date(),
    loadReminder: async () => (await loadSettings()).reminder,
    listStudyDays: async () => (await listStudyDays()).map((d) => d.day),
    permission: () => Notification.permission,
    show: (title, options) => scope.registration.showNotification(title, options),
    saveLastSent: (day, reminder) => saveSetting('reminder', { ...reminder, lastSentDay: day }),
  };
}

/** Wires the daily reminder into the service worker: the periodic sync that shows it, and the tap that opens the app. */
export function installReminder(scope: ReminderScope): void {
  scope.addEventListener('periodicsync', (event) => {
    if (event.tag === REMINDER_TAG) event.waitUntil(remindIfNeeded(reminderDeps(scope)));
  });
  scope.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(openApp(scope));
  });
}

async function openApp(scope: ReminderScope): Promise<void> {
  const [open] = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (open) await open.focus();
  else await scope.clients.openWindow(scope.registration.scope);
}
