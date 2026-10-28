import { diagnostics } from '../lib/diagnostics';
import { localDay } from '../lib/streak';
import { db } from './schema';
import { tracedTransaction } from './trace';
import type { StudyDay } from './types';

/** All study days, oldest first. */
export function listStudyDays(): Promise<StudyDay[]> {
  return diagnostics.trace('listStudyDays', () => db.studyDays.orderBy('day').toArray());
}

/** Counts one more completed round on the local day of `now`. Call it inside a transaction that includes `db.studyDays`. */
export async function bumpStudyDay(now: number): Promise<void> {
  const day = localDay(now);
  const existing = await db.studyDays.get(day);
  await db.studyDays.put({ day, rounds: (existing?.rounds ?? 0) + 1 });
}

export function recordStudyDay(now: number = Date.now()): Promise<void> {
  return tracedTransaction('recordStudyDay', 'rw', [db.studyDays], () => bumpStudyDay(now));
}
