import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { loadSettings, saveSetting } from '../../db/settings';

interface Browser {
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  showNotification: ReturnType<typeof vi.fn>;
}

function stubBrowser(options: { permission?: NotificationPermission; asked?: NotificationPermission; sync?: PermissionState } = {}): Browser {
  const { permission = 'default', asked = 'granted', sync = 'granted' } = options;
  const register = vi.fn(async () => undefined);
  const unregister = vi.fn(async () => undefined);
  const showNotification = vi.fn(async () => undefined);
  const state = { permission };
  vi.stubGlobal(
    'Notification',
    Object.assign(function Notification() {}, {
      get permission() {
        return state.permission;
      },
      requestPermission: async () => {
        state.permission = asked;
        return asked;
      },
    }),
  );
  vi.stubGlobal('PeriodicSyncManager', class {});
  const registration = { periodicSync: { register, unregister }, showNotification };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: { query: async () => ({ state: sync }) } });
  return { register, unregister, showNotification };
}

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(navigator, 'permissions');
});

describe('the daily reminder on the streak page', () => {
  it('is off by default, at 19:30', async () => {
    stubBrowser();
    renderRoute('/streak');
    expect(await screen.findByRole('switch', { name: 'Remind me to learn' })).not.toBeChecked();
    expect(screen.getByLabelText('Reminder time')).toHaveValue('19:30');
  });

  it('explains that Chrome decides when it wakes the app', async () => {
    stubBrowser();
    renderRoute('/streak');
    expect(await screen.findByText(/can arrive a few hours after this time/)).toBeInTheDocument();
  });

  it('says where reminders work, and stays off, in a browser without periodic sync', async () => {
    renderRoute('/streak');
    const toggle = await screen.findByRole('switch', { name: 'Remind me to learn' });
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/Chrome on Android, with Quizly installed/)).toBeInTheDocument();
  });

  it('switches on: asks for the permission, registers the sync and saves the setting', async () => {
    const { register } = stubBrowser();
    const { user } = renderRoute('/streak');
    await user.click(await screen.findByRole('switch', { name: 'Remind me to learn' }));
    await waitFor(async () => expect((await loadSettings()).reminder.enabled).toBe(true));
    expect(register).toHaveBeenCalledWith('daily-reminder', expect.any(Object));
    expect(screen.getByRole('switch', { name: 'Remind me to learn' })).toBeChecked();
  });

  it('stays off and explains when the notifications are blocked', async () => {
    const { register } = stubBrowser({ asked: 'denied' });
    const { user } = renderRoute('/streak');
    await user.click(await screen.findByRole('switch', { name: 'Remind me to learn' }));
    expect(await screen.findByText(/Notifications are blocked for Quizly/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Remind me to learn' })).not.toBeChecked();
    expect((await loadSettings()).reminder.enabled).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('stays off and says Quizly has to be installed when Chrome refuses periodic sync', async () => {
    stubBrowser({ sync: 'denied' });
    const { user } = renderRoute('/streak');
    await user.click(await screen.findByRole('switch', { name: 'Remind me to learn' }));
    expect(await screen.findByText(/Add Quizly to your home screen/)).toBeInTheDocument();
    expect((await loadSettings()).reminder.enabled).toBe(false);
  });

  it('switches off: unregisters the sync and saves the setting', async () => {
    const { unregister } = stubBrowser({ permission: 'granted' });
    await saveSetting('reminder', { enabled: true, time: '19:30' });
    const { user } = renderRoute('/streak');
    const toggle = await screen.findByRole('switch', { name: 'Remind me to learn' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(async () => expect((await loadSettings()).reminder.enabled).toBe(false));
    expect(unregister).toHaveBeenCalledWith('daily-reminder');
  });

  it('saves a new time and keeps the rest', async () => {
    stubBrowser();
    await saveSetting('reminder', { enabled: true, time: '19:30', lastSentDay: '2026-10-27' });
    const { user } = renderRoute('/streak');
    const time = await screen.findByLabelText('Reminder time');
    await user.clear(time);
    await user.type(time, '08:15');
    await waitFor(async () => expect((await loadSettings()).reminder).toEqual({ enabled: true, time: '08:15', lastSentDay: '2026-10-27' }));
  });

  it('offers a test notification only while the reminder is on and allowed', async () => {
    stubBrowser({ permission: 'granted' });
    renderRoute('/streak');
    await screen.findByRole('switch', { name: 'Remind me to learn' });
    expect(screen.queryByRole('button', { name: 'Send a test notification' })).not.toBeInTheDocument();
  });

  it('sends the test notification', async () => {
    const { showNotification } = stubBrowser({ permission: 'granted' });
    await saveSetting('reminder', { enabled: true, time: '19:30' });
    const { user } = renderRoute('/streak');
    await user.click(await screen.findByRole('button', { name: 'Send a test notification' }));
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
  });

  it('says when the test notification could not be shown', async () => {
    const { showNotification } = stubBrowser({ permission: 'granted' });
    showNotification.mockRejectedValueOnce(new Error('x'));
    await saveSetting('reminder', { enabled: true, time: '19:30' });
    const { user } = renderRoute('/streak');
    await user.click(await screen.findByRole('button', { name: 'Send a test notification' }));
    expect(await screen.findByText("Couldn't show a notification. Check the notification settings of Quizly.")).toBeInTheDocument();
  });

  it('warns when the permission was withdrawn after the reminder was switched on', async () => {
    stubBrowser({ permission: 'denied' });
    await saveSetting('reminder', { enabled: true, time: '19:30' });
    renderRoute('/streak');
    expect(await screen.findByText(/Notifications are blocked for Quizly/)).toBeInTheDocument();
  });
});
