import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './schema';
import { listCards } from './cards';
import type { Card, StudySet } from './types';

export interface SetData {
  loading: boolean;
  set: StudySet | undefined;
  cards: Card[];
}

const NO_CARDS: Card[] = [];

/** Live view of one set and its cards. `set` is undefined when the id is unknown. */
export function useSetData(setId: string | undefined): SetData {
  const data = useLiveQuery(async () => {
    if (!setId) return null;
    const set = await db.sets.get(setId);
    if (!set) return null;
    return { set, cards: await listCards(setId) };
  }, [setId]);
  return { loading: data === undefined, set: data?.set, cards: data?.cards ?? NO_CARDS };
}
