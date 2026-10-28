import { describe, expect, it, vi } from 'vitest';
import type { ReminderSettings } from '../lib/reminder';
import { remindIfNeeded, type ReminderDeps } from './reminderWorker';

const at = (h: number, m = 0) => new Date(2026, 9, 28, h, m);

function deps(overrides: Partial<ReminderDeps> & { reminder?: ReminderSettings; days?: string[] } = {}) {
  const { reminder = { enabled: true, time: '19:30' }, days = [], ...rest } = overrides;
  const state = {
    show: vi.fn(async () => undefined),
    saveLastSent: vi.fn(async () => undefined),
  };
  const all: ReminderDeps = {
    now: () => at(20),
    loadReminder: async () => reminder,
    listStudyDays: async () => days,
    permission: () => 'granted',
    show: state.show,
    saveLastSent: state.saveLastSent,
    ...rest,
  };
  return { all, ...state };
}

describe('remindIfNeeded', () => {
  it('shows the reminder and remembers that it was sent today', async () => {
    const { all, show, saveLastSent } = deps({ days: ['2026-10-26', '2026-10-27'] });
    expect(await remindIfNeeded(all)).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    const [title, options] = show.mock.calls[0] as unknown as [string, NotificationOptions];
    expect(title).toBe('Time to learn');
    expect(options.body).toBe('Finish a round today to keep your 2-day streak.');
    expect(options.tag).toBe('daily-reminder');
    expect(saveLastSent).toHaveBeenCalledWith('2026-10-28', { enabled: true, time: '19:30' });
  });

  it('says to start a streak when there is none', async () => {
    const { all, show } = deps();
    await remindIfNeeded(all);
    expect((show.mock.calls[0] as unknown as [string, NotificationOptions])[1].body).toBe('Finish a round today to start a streak.');
  });

  it.each([
    ['before the time', { now: () => at(19, 0) }],
    ['when today was already studied', { days: ['2026-10-28'] }],
    ['when the reminder is off', { reminder: { enabled: false, time: '19:30' } }],
    ['when one was already sent today', { reminder: { enabled: true, time: '19:30', lastSentDay: '2026-10-28' } }],
    ['without the permission', { permission: () => 'denied' as const }],
    ['when the permission was never asked', { permission: () => 'default' as const }],
  ])('does nothing %s', async (_label, overrides) => {
    const { all, show, saveLastSent } = deps(overrides);
    expect(await remindIfNeeded(all)).toBe(false);
    expect(show).not.toHaveBeenCalled();
    expect(saveLastSent).not.toHaveBeenCalled();
  });

  it('does not mark the day as sent when showing fails, so the next wake-up tries again', async () => {
    const { all, saveLastSent } = deps({
      show: async () => {
        throw new Error('no notification');
      },
    });
    expect(await remindIfNeeded(all)).toBe(false);
    expect(saveLastSent).not.toHaveBeenCalled();
  });

  it('does not fail when the data cannot be read', async () => {
    const { all, show } = deps({
      listStudyDays: async () => {
        throw new Error('db');
      },
    });
    expect(await remindIfNeeded(all)).toBe(false);
    expect(show).not.toHaveBeenCalled();
  });
});
