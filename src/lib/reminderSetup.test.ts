import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { disableReminder, enableReminder, notificationPermission, reminderSupport, showTestNotification } from './reminderSetup';

interface Stubs {
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  showNotification: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
}

/** A browser with notifications, a service worker with periodic sync, and the given permission states. */
function stubBrowser(options: { permission?: NotificationPermission; asked?: NotificationPermission; sync?: PermissionState; registerFails?: boolean } = {}): Stubs {
  const { permission = 'default', asked = 'granted', sync = 'granted', registerFails = false } = options;
  const register = vi.fn(async () => {
    if (registerFails) throw new Error('boom');
  });
  const unregister = vi.fn(async () => undefined);
  const showNotification = vi.fn(async () => undefined);
  const requestPermission = vi.fn(async () => asked);
  const registration = { periodicSync: { register, unregister }, showNotification };
  vi.stubGlobal('Notification', Object.assign(function Notification() {}, { permission, requestPermission }));
  vi.stubGlobal('PeriodicSyncManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: sync }) } });
  return { register, unregister, showNotification, requestPermission };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('reminderSupport', () => {
  it('is ok in a browser with notifications, a service worker and periodic sync', () => {
    stubBrowser();
    expect(reminderSupport()).toEqual({ ok: true });
  });

  it('says what is missing', () => {
    expect(reminderSupport()).toEqual({ ok: false, reason: 'no-notifications' });
    vi.stubGlobal('Notification', function Notification() {});
    expect(reminderSupport()).toEqual({ ok: false, reason: 'no-service-worker' });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
    expect(reminderSupport()).toEqual({ ok: false, reason: 'no-periodic-sync' });
  });
});

describe('notificationPermission', () => {
  it('reports the permission, or that notifications are not supported', () => {
    expect(notificationPermission()).toBe('unsupported');
    stubBrowser({ permission: 'denied' });
    expect(notificationPermission()).toBe('denied');
  });
});

describe('enableReminder', () => {
  it('asks for the permission, then registers the periodic sync', async () => {
    const { register, requestPermission } = stubBrowser();
    expect(await enableReminder()).toEqual({ ok: true });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('daily-reminder', { minInterval: 60 * 60 * 1000 });
  });

  it('does not ask again when the permission is already granted', async () => {
    const { requestPermission } = stubBrowser({ permission: 'granted' });
    expect(await enableReminder()).toEqual({ ok: true });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('fails without registering anything when the permission is refused', async () => {
    const { register } = stubBrowser({ asked: 'denied' });
    expect(await enableReminder()).toEqual({ ok: false, reason: 'permission-denied' });
    expect(register).not.toHaveBeenCalled();
  });

  it('does not ask for the permission at all once it was blocked', async () => {
    const { requestPermission } = stubBrowser({ permission: 'denied' });
    expect(await enableReminder()).toEqual({ ok: false, reason: 'permission-denied' });
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('says the app has to be installed when Chrome refuses periodic sync', async () => {
    const { register } = stubBrowser({ sync: 'denied' });
    expect(await enableReminder()).toEqual({ ok: false, reason: 'not-installed' });
    expect(register).not.toHaveBeenCalled();
  });

  it('reports an error when registering fails', async () => {
    stubBrowser({ registerFails: true });
    expect(await enableReminder()).toEqual({ ok: false, reason: 'error' });
  });

  it('reports unsupported browsers', async () => {
    expect(await enableReminder()).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('disableReminder', () => {
  it('unregisters the periodic sync', async () => {
    const { unregister } = stubBrowser();
    await disableReminder();
    expect(unregister).toHaveBeenCalledWith('daily-reminder');
  });

  it('never throws', async () => {
    await expect(disableReminder()).resolves.toBeUndefined();
    const { unregister } = stubBrowser();
    unregister.mockRejectedValueOnce(new Error('x'));
    await expect(disableReminder()).resolves.toBeUndefined();
  });
});

describe('showTestNotification', () => {
  it('shows a notification through the service worker', async () => {
    const { showNotification } = stubBrowser({ permission: 'granted' });
    expect(await showTestNotification()).toBe(true);
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification.mock.calls[0][0]).toBe('Quizly reminders work');
  });

  it('does nothing without the permission', async () => {
    const { showNotification } = stubBrowser({ permission: 'default' });
    expect(await showTestNotification()).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('reports false when showing fails', async () => {
    const { showNotification } = stubBrowser({ permission: 'granted' });
    showNotification.mockRejectedValueOnce(new Error('x'));
    expect(await showTestNotification()).toBe(false);
  });
});
