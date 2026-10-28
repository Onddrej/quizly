import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSetting } from './settings';
import { DEFAULT_SETTINGS } from './types';
import { resetDb } from '../test/db';

beforeEach(resetDb);

describe('the reminder setting', () => {
  it('is off at 19:30 by default', async () => {
    expect((await loadSettings()).reminder).toEqual({ enabled: false, time: '19:30' });
    expect(DEFAULT_SETTINGS.reminder).toEqual({ enabled: false, time: '19:30' });
  });

  it('is saved and loaded', async () => {
    await saveSetting('reminder', { enabled: true, time: '08:15', lastSentDay: '2026-10-27' });
    expect((await loadSettings()).reminder).toEqual({ enabled: true, time: '08:15', lastSentDay: '2026-10-27' });
  });

  it('fills in what an older save lacks', async () => {
    await saveSetting('reminder', { enabled: true } as never);
    expect((await loadSettings()).reminder).toEqual({ enabled: true, time: '19:30' });
  });
});
