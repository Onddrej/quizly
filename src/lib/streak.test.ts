import { describe, expect, it } from 'vitest';
import { addDays, bestStreak, currentLesson, currentStreak, localDay, monthGrid, weekDays } from './streak';

const days = (...list: string[]) => new Set(list);

describe('localDay', () => {
  it('formats a time as the local calendar day', () => {
    expect(localDay(new Date(2026, 9, 28, 19, 30).getTime())).toBe('2026-10-28');
    expect(localDay(new Date(2026, 0, 5, 0, 1).getTime())).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31');
  });
});

describe('addDays', () => {
  it('moves across month and year ends, in both directions', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-10-28', 0)).toBe('2026-10-28');
  });

  it('is not thrown off by a daylight saving change', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });
});

describe('currentStreak', () => {
  it('counts the consecutive days up to and including today', () => {
    expect(currentStreak(days('2026-10-26', '2026-10-27', '2026-10-28'), '2026-10-28')).toBe(3);
  });

  it('keeps the streak alive while today is still open: it ends yesterday', () => {
    expect(currentStreak(days('2026-10-25', '2026-10-26', '2026-10-27'), '2026-10-28')).toBe(3);
  });

  it('is zero once a whole day was missed', () => {
    expect(currentStreak(days('2026-10-24', '2026-10-25', '2026-10-26'), '2026-10-28')).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(days('2026-10-20', '2026-10-21', '2026-10-27', '2026-10-28'), '2026-10-28')).toBe(2);
  });

  it('is zero without any study days, and ignores days in the future', () => {
    expect(currentStreak(days(), '2026-10-28')).toBe(0);
    expect(currentStreak(days('2026-10-29', '2026-10-30'), '2026-10-28')).toBe(0);
  });

  it('counts across a month end', () => {
    expect(currentStreak(days('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-01')).toBe(3);
  });
});

describe('bestStreak', () => {
  it('is the longest run of consecutive days anywhere', () => {
    expect(bestStreak(days('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-27', '2026-10-28'))).toBe(4);
  });

  it('is zero for no days and one for a single day', () => {
    expect(bestStreak(days())).toBe(0);
    expect(bestStreak(days('2026-10-28'))).toBe(1);
  });

  it('does not depend on the order the days were stored in', () => {
    expect(bestStreak(['2026-10-03', '2026-10-01', '2026-10-02'])).toBe(3);
  });
});

describe('weekDays', () => {
  // 2026-10-28 is a Wednesday
  it('gives the Monday to Sunday week that contains today', () => {
    const week = weekDays('2026-10-28', days());
    expect(week.map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(week.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });

  it('marks done days, today, missed days and days to come', () => {
    const week = weekDays('2026-10-28', days('2026-10-26'));
    expect(week.map((d) => d.state)).toEqual(['done', 'open', 'open', 'future', 'future', 'future', 'future']);
    expect(week.map((d) => d.isToday)).toEqual([false, false, true, false, false, false, false]);
  });

  it('keeps today marked as today when it is done too', () => {
    const week = weekDays('2026-10-28', days('2026-10-28'));
    expect(week[2]).toMatchObject({ state: 'done', isToday: true });
  });

  it('starts the week on Monday also when today is a Sunday or a Monday', () => {
    expect(weekDays('2026-11-01', days())[0].day).toBe('2026-10-26');
    expect(weekDays('2026-10-26', days())[0].day).toBe('2026-10-26');
  });
});

describe('monthGrid', () => {
  it('lays out October 2026 in Monday-first weeks, padded with days of the neighbouring months', () => {
    const grid = monthGrid(2026, 9, days('2026-10-02'), '2026-10-28');
    expect(grid).toHaveLength(5);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // October 1st is a Thursday
    expect(grid[0].map((c) => c.day)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(grid[0].map((c) => c.inMonth)).toEqual([false, false, false, true, true, true, true]);
    expect(grid[4].map((c) => c.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    expect(grid[4].map((c) => c.inMonth)).toEqual([true, true, true, true, true, true, false]);
  });

  it('marks done days, today and days to come', () => {
    const grid = monthGrid(2026, 9, days('2026-10-02', '2026-10-27'), '2026-10-28');
    const cell = (day: string) => grid.flat().find((c) => c.day === day)!;
    expect(cell('2026-10-02')).toMatchObject({ date: 2, done: true, isToday: false, future: false });
    expect(cell('2026-10-03')).toMatchObject({ done: false, isToday: false, future: false });
    expect(cell('2026-10-28')).toMatchObject({ date: 28, done: false, isToday: true, future: false });
    expect(cell('2026-10-29')).toMatchObject({ done: false, future: true });
  });

  it('does not mark a study day of a neighbouring month as done in this month', () => {
    const grid = monthGrid(2026, 9, days('2026-09-30'), '2026-10-28');
    expect(grid[0][2]).toMatchObject({ day: '2026-09-30', inMonth: false, done: true });
  });

  it('adds a sixth week when the month needs it', () => {
    // August 2026 starts on a Saturday and has 31 days
    expect(monthGrid(2026, 7, days(), '2026-10-28')).toHaveLength(6);
  });

  it('needs only four weeks for a February that starts on a Monday', () => {
    // February 2027 starts on a Monday and has 28 days
    expect(monthGrid(2027, 1, days(), '2026-10-28')).toHaveLength(4);
  });
});

describe('currentLesson', () => {
  it('is the number of study days so far plus today, while today is not studied yet', () => {
    expect(currentLesson(days('2026-10-26', '2026-10-27'), '2026-10-28')).toBe(3);
  });

  it('does not count today twice once it is studied', () => {
    expect(currentLesson(days('2026-10-26', '2026-10-27', '2026-10-28'), '2026-10-28')).toBe(3);
  });

  it('starts at the first lesson with no history', () => {
    expect(currentLesson(days(), '2026-10-28')).toBe(1);
  });

  it('does not run on while the app is not used: a long pause adds nothing', () => {
    expect(currentLesson(days('2026-01-01', '2026-01-02'), '2026-10-28')).toBe(3);
    expect(currentLesson(days('2026-01-01', '2026-01-02'), '2026-11-28')).toBe(3);
  });
});
