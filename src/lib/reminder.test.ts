import { describe, expect, it } from 'vitest';
import { REMINDER_TAG, isValidTime, reminderMessage, shouldRemind, timeToMinutes } from './reminder';

const at = (h: number, m = 0) => new Date(2026, 9, 28, h, m);
const base = { enabled: true, time: '19:30' };

describe('isValidTime and timeToMinutes', () => {
  it('accepts HH:MM times and turns them into minutes after midnight', () => {
    expect(isValidTime('19:30')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(timeToMinutes('19:30')).toBe(1170);
    expect(timeToMinutes('00:05')).toBe(5);
  });

  it('rejects anything else', () => {
    for (const t of ['', '7:30', '24:00', '19:60', '19-30', 'abc', '19:3', ' 19:30']) expect(isValidTime(t)).toBe(false);
  });
});

describe('shouldRemind', () => {
  it('is true once the chosen time has come, when today has no round yet and no reminder was sent today', () => {
    expect(shouldRemind({ now: at(19, 30), reminder: base, studiedToday: false })).toBe(true);
    expect(shouldRemind({ now: at(22, 10), reminder: base, studiedToday: false })).toBe(true);
  });

  it('is false before the chosen time', () => {
    expect(shouldRemind({ now: at(19, 29), reminder: base, studiedToday: false })).toBe(false);
    expect(shouldRemind({ now: at(8, 0), reminder: base, studiedToday: false })).toBe(false);
  });

  it('is false when the reminder is switched off', () => {
    expect(shouldRemind({ now: at(20), reminder: { ...base, enabled: false }, studiedToday: false })).toBe(false);
  });

  it('is false when a round was already completed today: nothing is left to remind of', () => {
    expect(shouldRemind({ now: at(20), reminder: base, studiedToday: true })).toBe(false);
  });

  it('sends one reminder a day: not again once it was sent today, but again the next day', () => {
    const sent = { ...base, lastSentDay: '2026-10-28' };
    expect(shouldRemind({ now: at(21), reminder: sent, studiedToday: false })).toBe(false);
    expect(shouldRemind({ now: new Date(2026, 9, 29, 19, 45), reminder: sent, studiedToday: false })).toBe(true);
  });

  it('is false with a time that is not a time, rather than reminding at a random moment', () => {
    expect(shouldRemind({ now: at(20), reminder: { enabled: true, time: 'soon' }, studiedToday: false })).toBe(false);
  });
});

describe('reminderMessage', () => {
  it('asks to keep a running streak going', () => {
    expect(reminderMessage(12)).toEqual({ title: 'Time to learn', body: 'Finish a round today to keep your 12-day streak.' });
  });

  it('talks about a single day in the singular', () => {
    expect(reminderMessage(1).body).toBe('Finish a round today to keep your 1-day streak.');
  });

  it('invites to start a streak when there is none', () => {
    expect(reminderMessage(0)).toEqual({ title: 'Time to learn', body: 'Finish a round today to start a streak.' });
  });
});

describe('REMINDER_TAG', () => {
  it('is the name the periodic sync is registered under', () => {
    expect(REMINDER_TAG).toBe('daily-reminder');
  });
});
