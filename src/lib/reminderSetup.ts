/**
 * The browser side of the daily reminder: notification permission and the periodic background sync that wakes the
 * service worker (sw.ts). The only module that touches `Notification` and `periodicSync`. Everything here is best
 * effort: periodic sync exists only in Chromium and only for an installed app, and the browser decides when it fires.
 */
import { REMINDER_TAG } from './reminder';

/** How often the app asks to be woken; Chrome applies its own limits (it may be much rarer). */
const MIN_INTERVAL_MS = 60 * 60 * 1000;

interface PeriodicSyncManagerLike {
  register(tag: string, options?: { minInterval?: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
}
type PeriodicRegistration = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManagerLike };

export type UnsupportedReason = 'no-notifications' | 'no-service-worker' | 'no-periodic-sync';
export type EnableFailure = 'unsupported' | 'permission-denied' | 'not-installed' | 'error';

export function reminderSupport(): { ok: true } | { ok: false; reason: UnsupportedReason } {
  if (!('Notification' in globalThis)) return { ok: false, reason: 'no-notifications' };
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-service-worker' };
  if (!('PeriodicSyncManager' in globalThis)) return { ok: false, reason: 'no-periodic-sync' };
  return { ok: true };
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in globalThis ? Notification.permission : 'unsupported';
}

const registration = () => navigator.serviceWorker.ready as Promise<PeriodicRegistration>;

/** Asks for the notification permission (once) and registers the periodic sync that wakes the service worker. */
export async function enableReminder(): Promise<{ ok: true } | { ok: false; reason: EnableFailure }> {
  if (!reminderSupport().ok) return { ok: false, reason: 'unsupported' };
  try {
    if (Notification.permission === 'denied') return { ok: false, reason: 'permission-denied' };
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };
    const sync = (await registration()).periodicSync;
    if (!sync) return { ok: false, reason: 'unsupported' };
    // Chrome grants this only to an installed app
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (status.state !== 'granted') return { ok: false, reason: 'not-installed' };
    await sync.register(REMINDER_TAG, { minInterval: MIN_INTERVAL_MS });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function disableReminder(): Promise<void> {
  try {
    await (await registration()).periodicSync?.unregister(REMINDER_TAG);
  } catch {
    // nothing to undo when the browser has no periodic sync or no service worker
  }
}

/** Shows a notification right now, to check that notifications work on this device. Returns whether it was shown. */
export async function showTestNotification(): Promise<boolean> {
  try {
    if (notificationPermission() !== 'granted') return false;
    await (await registration()).showNotification('Quizly reminders work', {
      body: 'This is how your daily reminder will look.',
      tag: `${REMINDER_TAG}-test`,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
    });
    return true;
  } catch {
    return false;
  }
}
