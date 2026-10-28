import { useLiveQuery } from 'dexie-react-hooks';
import { listStudyDays } from '../../db/studyLog';

/** The days on which a round was completed, as a list of `YYYY-MM-DD`; `undefined` until they are read. */
export function useStudyDays(): string[] | undefined {
  const rows = useLiveQuery(listStudyDays, []);
  return rows?.map((r) => r.day);
}
