import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import {
  completeRound,
  createSet,
  deleteSet,
  getSet,
  listSetSummaries,
  markStudied,
  resetProgress,
  updateSet,
} from './sets';
import { listCards, setCardStage, toggleStar } from './cards';
import { loadSettings, saveSetting } from './settings';
import { DEFAULT_SETTINGS } from './types';
import { resetDb } from '../test/db';

const twoCards = [
  { term: 'gate', definition: 'brána' },
  { term: ' delay ', definition: 'meškanie' },
];

beforeEach(resetDb);

describe('sets', () => {
  it('createSet stores the trimmed set and its cards in order at stage 0', async () => {
    const id = await createSet({ title: ' Travel ', definitionLang: 'sk', cards: twoCards }, 1000);
    expect(await getSet(id)).toMatchObject({ title: 'Travel', definitionLang: 'sk', createdAt: 1000, updatedAt: 1000, learnRound: 1 });
    const cards = await listCards(id);
    expect(cards.map((c) => [c.term, c.position, c.stage, c.starred])).toEqual([
      ['gate', 0, 0, false],
      ['delay', 1, 0, false],
    ]);
  });

  it('updateSet keeps progress of edited cards, deletes removed cards and adds new ones', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate, delay] = await listCards(id);
    await setCardStage(gate.id, 3, 500);
    await updateSet(
      id,
      { title: 'T2', definitionLang: 'cs', cards: [{ id: gate.id, term: 'gates', definition: 'brány' }, { term: 'customs', definition: 'colnica' }] },
      2000,
    );
    const cards = await listCards(id);
    expect(cards.map((c) => [c.term, c.stage, c.position])).toEqual([
      ['gates', 3, 0],
      ['customs', 0, 1],
    ]);
    expect(await db.cards.get(delay.id)).toBeUndefined();
    expect(await getSet(id)).toMatchObject({ title: 'T2', definitionLang: 'cs', updatedAt: 2000 });
  });

  it('deleteSet removes the set and its cards', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    await deleteSet(id);
    expect(await getSet(id)).toBeUndefined();
    expect(await db.cards.count()).toBe(0);
  });

  it('resetProgress puts every card back to stage 0 and the round to 1', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate] = await listCards(id);
    await setCardStage(gate.id, 4, 100);
    await completeRound(id);
    await resetProgress(id);
    const cards = await listCards(id);
    expect(cards.every((c) => c.stage === 0 && c.lastAnsweredAt === undefined)).toBe(true);
    expect((await getSet(id))?.learnRound).toBe(1);
  });

  it('completeRound increments the round and markStudied records the time', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    await completeRound(id);
    await markStudied(id, 4242);
    expect(await getSet(id)).toMatchObject({ learnRound: 2, lastStudiedAt: 4242 });
  });

  it('listSetSummaries counts statuses and sorts by last activity', async () => {
    const travel = await createSet({ title: 'Travel', definitionLang: 'sk', cards: twoCards }, 1000);
    await createSet({ title: 'Kitchen', definitionLang: 'sk', cards: twoCards }, 2000);
    const [gate] = await listCards(travel);
    await setCardStage(gate.id, 4, 10);
    await markStudied(travel, 3000);
    const summaries = await listSetSummaries();
    expect(summaries.map((s) => s.set.title)).toEqual(['Travel', 'Kitchen']);
    expect(summaries[0]).toMatchObject({ total: 2, counts: { mastered: 1, learning: 0, notStudied: 1 } });
  });
});

describe('cards', () => {
  it('toggleStar flips the starred flag', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate] = await listCards(id);
    await toggleStar(gate.id);
    expect((await db.cards.get(gate.id))?.starred).toBe(true);
    await toggleStar(gate.id);
    expect((await db.cards.get(gate.id))?.starred).toBe(false);
  });
});

describe('settings', () => {
  it('returns defaults and merges saved values', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
    await saveSetting('theme', 'dark');
    await saveSetting('flashcards', { ...DEFAULT_SETTINGS.flashcards, autoplay: true });
    const settings = await loadSettings();
    expect(settings.theme).toBe('dark');
    expect(settings.flashcards.autoplay).toBe(true);
    expect(settings.accent).toBe('en-US');
  });
});
