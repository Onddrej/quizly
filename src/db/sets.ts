// Writes keyed by an id that does not exist are silent no-ops, except updateSet, which throws.

import { db } from './schema';
import type { Card, StudySet } from './types';
import { newId } from '../lib/id';
import { countStatuses, type StatusCounts } from '../lib/progress';
import { requestPersistentStorage } from '../lib/storage';

export interface CardDraft {
  id?: string;
  term: string;
  definition: string;
}

export interface SetDraft {
  title: string;
  definitionLang: string;
  cards: CardDraft[];
}

export interface SetSummary {
  set: StudySet;
  total: number;
  counts: StatusCounts;
}

function newCard(setId: string, draft: CardDraft, position: number): Card {
  return {
    id: newId(),
    setId,
    term: draft.term.trim(),
    definition: draft.definition.trim(),
    position,
    starred: false,
    stage: 0,
  };
}

export function getSet(setId: string): Promise<StudySet | undefined> {
  return db.sets.get(setId);
}

/** Not idempotent: every call creates a new set (the editor disables Save while saving). Asks the browser for persistent storage (spec 6.3). */
export async function createSet(draft: SetDraft, now: number = Date.now()): Promise<string> {
  const id = newId();
  await db.transaction('rw', db.sets, db.cards, async () => {
    await db.sets.add({
      id,
      title: draft.title.trim(),
      definitionLang: draft.definitionLang,
      createdAt: now,
      updatedAt: now,
      learnRound: 1,
    });
    await db.cards.bulkAdd(draft.cards.map((c, i) => newCard(id, c, i)));
  });
  void requestPersistentStorage();
  return id;
}

/**
 * Replaces the set's title, language and cards in one transaction. A draft card with an `id` of this set keeps its stage,
 * star and answer time; a draft card without one (or with an id from another set) becomes a new card; cards missing from
 * the draft are deleted together with their progress. The draft is not validated here (the editor does that).
 * Throws, and writes nothing, when the set does not exist.
 */
export async function updateSet(setId: string, draft: SetDraft, now: number = Date.now()): Promise<void> {
  await db.transaction('rw', db.sets, db.cards, async () => {
    const updated = await db.sets.update(setId, { title: draft.title.trim(), definitionLang: draft.definitionLang, updatedAt: now });
    if (updated === 0) throw new Error('Set not found');
    const existing = await db.cards.where('setId').equals(setId).toArray();
    const byId = new Map(existing.map((c) => [c.id, c]));
    const kept = new Set<string>();
    const rows = draft.cards.map((c, position): Card => {
      const previous = c.id ? byId.get(c.id) : undefined;
      if (!previous) return newCard(setId, c, position);
      kept.add(previous.id);
      return { ...previous, term: c.term.trim(), definition: c.definition.trim(), position };
    });
    await db.cards.bulkDelete(existing.filter((c) => !kept.has(c.id)).map((c) => c.id));
    await db.cards.bulkPut(rows);
  });
}

export async function deleteSet(setId: string): Promise<void> {
  await db.transaction('rw', db.sets, db.cards, async () => {
    await db.cards.where('setId').equals(setId).delete();
    await db.sets.delete(setId);
  });
}

/** Puts every card of the set back to stage 0 (answer times cleared) and the round to 1. Stars and lastStudiedAt are kept. */
export async function resetProgress(setId: string): Promise<void> {
  await db.transaction('rw', db.sets, db.cards, async () => {
    await db.cards.where('setId').equals(setId).modify((card) => {
      card.stage = 0;
      delete card.lastAnsweredAt;
    });
    await db.sets.update(setId, { learnRound: 1 });
  });
}

export async function completeRound(setId: string): Promise<void> {
  await db.sets.where('id').equals(setId).modify((set) => {
    set.learnRound += 1;
  });
}

export async function markStudied(setId: string, now: number = Date.now()): Promise<void> {
  await db.sets.update(setId, { lastStudiedAt: now });
}

export async function listSetSummaries(): Promise<SetSummary[]> {
  const [sets, cards] = await Promise.all([db.sets.toArray(), db.cards.toArray()]);
  const bySet = new Map<string, Card[]>();
  for (const card of cards) {
    const list = bySet.get(card.setId) ?? [];
    list.push(card);
    bySet.set(card.setId, list);
  }
  return sets
    .map((set) => {
      const list = bySet.get(set.id) ?? [];
      return { set, total: list.length, counts: countStatuses(list) };
    })
    .sort((a, b) => (b.set.lastStudiedAt ?? b.set.updatedAt) - (a.set.lastStudiedAt ?? a.set.updatedAt));
}
