import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../test/db';
import { loadSettings, saveSetting } from '../db/settings';
import { recordStudyDay } from '../db/studyLog';
import { installReminder, type ReminderScope } from './swReminder';

type Listener = (event: any) => void;

function fakeScope(windows: Array<{ focus: ReturnType<typeof vi.fn> }> = []) {
  const listeners = new Map<string, Listener>();
  const showNotification = vi.fn(async (_title: string, _options?: unknown) => undefined);
  const openWindow = vi.fn(async () => undefined);
  const scope = {
    registration: { scope: 'https://example.test/quizly/', showNotification },
    clients: { matchAll: vi.fn(async () => windows), openWindow },
    addEventListener: (type: string, listener: Listener) => void listeners.set(type, listener),
  } as unknown as ReminderScope;
  /** Fires an event and waits for what the handler handed to waitUntil. */
  async function fire(type: string, event: Record<string, unknown> = {}) {
    let pending: Promise<unknown> = Promise.resolve();
    listeners.get(type)?.({ ...event, waitUntil: (p: Promise<unknown>) => void (pending = p) });
    await pending;
  }
  return { scope, listeners, showNotification, openWindow, fire };
}

beforeEach(async () => {
  await resetDb();
  vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: 'granted' }));
});
afterEach(() => vi.unstubAllGlobals());

describe('installReminder: periodic sync', () => {
  it('listens for periodic sync and notification clicks', () => {
    const { scope, listeners } = fakeScope();
    installReminder(scope);
    expect([...listeners.keys()].sort()).toEqual(['notificationclick', 'periodicsync']);
  });

  it('shows the reminder when it is due', async () => {
    await saveSetting('reminder', { enabled: true, time: '00:00' });
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'daily-reminder' });
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toBe('Time to learn');
  });

  it('remembers the day it reminded, so the next wake-up stays quiet', async () => {
    await saveSetting('reminder', { enabled: true, time: '00:00' });
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'daily-reminder' });
    await fire('periodicsync', { tag: 'daily-reminder' });
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect((await loadSettings()).reminder.lastSentDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('stays quiet once a round was finished today', async () => {
    await saveSetting('reminder', { enabled: true, time: '00:00' });
    await recordStudyDay(Date.now());
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'daily-reminder' });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('stays quiet while the reminder is off', async () => {
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'daily-reminder' });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('stays quiet without the notification permission', async () => {
    vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission: 'denied' }));
    await saveSetting('reminder', { enabled: true, time: '00:00' });
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'daily-reminder' });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('ignores other sync tags', async () => {
    await saveSetting('reminder', { enabled: true, time: '00:00' });
    const { scope, showNotification, fire } = fakeScope();
    installReminder(scope);
    await fire('periodicsync', { tag: 'something-else' });
    expect(showNotification).not.toHaveBeenCalled();
  });
});

describe('installReminder: notification click', () => {
  it('closes the notification and focuses the open app', async () => {
    const focus = vi.fn(async () => undefined);
    const { scope, openWindow, fire } = fakeScope([{ focus }]);
    installReminder(scope);
    const close = vi.fn();
    await fire('notificationclick', { notification: { close } });
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens the app when it is not open', async () => {
    const { scope, openWindow, fire } = fakeScope();
    installReminder(scope);
    await fire('notificationclick', { notification: { close: vi.fn() } });
    expect(openWindow).toHaveBeenCalledWith('https://example.test/quizly/');
  });
});
