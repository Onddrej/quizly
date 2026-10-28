/**
 * Streak and calendar arithmetic over "study days": local calendar days (`YYYY-MM-DD`) on which at least one learning
 * round was completed. Pure functions, no clock of their own: `today` is always passed in.
 */

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

type DaySet = ReadonlySet<string> | readonly string[];

const toSet = (days: DaySet): ReadonlySet<string> => (days instanceof Set ? days : new Set(days));
const pad = (n: number) => String(n).padStart(2, '0');

/** UTC midnight of a `YYYY-MM-DD` day: all day arithmetic is done in UTC, so a daylight saving change cannot shift a day. */
function utc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The local calendar day of a time. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  return format(utc(day) + n * DAY_MS);
}

/** 0 for Monday ... 6 for Sunday. */
const mondayIndex = (ms: number) => (new Date(ms).getUTCDay() + 6) % 7;

/** The run of consecutive study days that ends today, or yesterday while today is still open. Zero after a missed day. */
export function currentStreak(studyDays: DaySet, today: string): number {
  const set = toSet(studyDays);
  let day = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** The longest run of consecutive study days anywhere in the history. */
export function bestStreak(studyDays: DaySet): number {
  const sorted = [...toSet(studyDays)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export interface WeekDay {
  day: string;
  label: string;
  /** `done`: studied. `open`: a day that can still be (today) or was not studied. `future`: not here yet. */
  state: 'done' | 'open' | 'future';
  isToday: boolean;
}

/** The Monday to Sunday week that contains today. */
export function weekDays(today: string, studyDays: DaySet): WeekDay[] {
  const set = toSet(studyDays);
  const monday = utc(today) - mondayIndex(utc(today)) * DAY_MS;
  return WEEKDAY_LABELS.map((label, i) => {
    const day = format(monday + i * DAY_MS);
    return { day, label, state: set.has(day) ? 'done' : day > today ? 'future' : 'open', isToday: day === today };
  });
}

export interface MonthCell {
  day: string;
  /** Day of the month, 1-31. */
  date: number;
  /** False for the padding days of the neighbouring months. */
  inMonth: boolean;
  done: boolean;
  isToday: boolean;
  future: boolean;
}

/** A month as Monday-first weeks of seven cells, padded with days of the neighbouring months. `month` is 0-11. */
export function monthGrid(year: number, month: number, studyDays: DaySet, today: string): MonthCell[][] {
  const set = toSet(studyDays);
  const first = Date.UTC(year, month, 1);
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = mondayIndex(first);
  const weeks = Math.ceil((lead + length) / 7);
  const start = first - lead * DAY_MS;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i): MonthCell => {
      const ms = start + (w * 7 + i) * DAY_MS;
      const day = format(ms);
      const d = new Date(ms);
      return {
        day,
        date: d.getUTCDate(),
        inMonth: d.getUTCMonth() === month && d.getUTCFullYear() === year,
        done: set.has(day),
        isToday: day === today,
        future: day > today,
      };
    }),
  );
}

/**
 * The number of the lesson in progress: the study days so far, plus today when it has not been studied yet. A "lesson" is
 * a day on which a round was completed, so the count stands still while the app is not used (spaced review is counted in
 * lessons, not in calendar days, so a long break does not make everything due at once).
 */
export function currentLesson(studyDays: DaySet, today: string): number {
  const set = toSet(studyDays);
  return set.size + (set.has(today) ? 0 : 1);
}
