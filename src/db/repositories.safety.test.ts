import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { db } from './schema';
import { completeRound, createSet, deleteSet, getSet, listSetSummaries, markStudied, resetProgress, updateSet } from './sets';
import { listCards, setCardStage, toggleStar } from './cards';
import { loadSettings, saveSetting } from './settings';
import { useSetData } from './useSetData';
import { DEFAULT_SETTINGS, type FlashcardPrefs } from './types';
import { resetDb } from '../test/db';

const twoCards = [
  { term: 'gate', definition: 'brána' },
  { term: ' delay ', definition: 'meškanie' },
];
const threeCards = [...twoCards, { term: 'customs', definition: 'colnica' }];
// Structured clone (IndexedDB) cannot store a function, so writing this value fails midway through a write.
const unstorable = { trim: () => () => 'x' } as unknown as string;

beforeEach(resetDb);

describe('isolation between sets', () => {
  it('no operation on one set changes another set or its cards', async () => {
    const a = await createSet({ title: 'A', definitionLang: 'sk', cards: threeCards }, 1000);
    const b = await createSet({ title: 'B', definitionLang: 'sk', cards: threeCards }, 1000);
    const [bGate] = await listCards(b);
    await setCardStage(bGate.id, 3, 50);
    await toggleStar(bGate.id);
    await markStudied(b, 60);
    const snapshot = async () => ({ set: await getSet(b), cards: await listCards(b) });
    const before = await snapshot();

    const [aGate, aDelay] = await listCards(a);
    await setCardStage(aGate.id, 2, 70);
    await toggleStar(aDelay.id);
    await updateSet(
      a,
      { title: 'A2', definitionLang: 'cs', cards: [{ id: aGate.id, term: 'gates', definition: 'brány' }, { term: 'new', definition: 'nový' }] },
      2000,
    );
    await completeRound(a);
    await markStudied(a, 3000);
    await resetProgress(a);
    expect(await snapshot()).toEqual(before);
    await deleteSet(a);
    expect(await snapshot()).toEqual(before);
  });
});

describe('updateSet details', () => {
  it('keeps stars and answer times, follows the draft order and trims text', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: threeCards });
    const [gate, delay, customs] = await listCards(id);
    await toggleStar(customs.id);
    await setCardStage(customs.id, 2, 700);
    await updateSet(
      id,
      {
        title: '  Travel 2  ',
        definitionLang: 'sk',
        cards: [
          { id: customs.id, term: '  customs  ', definition: ' colnica ' },
          { id: delay.id, term: 'delay', definition: 'meškanie' },
          { term: '  visa ', definition: ' vízum ' },
        ],
      },
      9,
    );
    const cards = await listCards(id);
    expect(cards.map((c) => [c.term, c.definition, c.position])).toEqual([
      ['customs', 'colnica', 0],
      ['delay', 'meškanie', 1],
      ['visa', 'vízum', 2],
    ]);
    expect(cards[0]).toMatchObject({ id: customs.id, starred: true, stage: 2, lastAnsweredAt: 700 });
    expect(await db.cards.get(gate.id)).toBeUndefined();
    expect((await getSet(id))?.title).toBe('Travel 2');
  });

  it('an id that belongs to another set creates a new card and leaves that set alone', async () => {
    const a = await createSet({ title: 'A', definitionLang: 'sk', cards: twoCards });
    const b = await createSet({ title: 'B', definitionLang: 'sk', cards: [{ term: 'bb', definition: 'bb' }] });
    const [bCard] = await listCards(b);
    await updateSet(a, { title: 'A', definitionLang: 'sk', cards: [{ id: bCard.id, term: 'stolen', definition: 'x' }] });
    expect(await listCards(b)).toEqual([bCard]);
    const aCards = await listCards(a);
    expect(aCards.map((c) => c.term)).toEqual(['stolen']);
    expect(aCards[0].id).not.toBe(bCard.id);
  });

  it('writes nothing for a set that does not exist', async () => {
    await updateSet('missing', { title: 'x', definitionLang: 'sk', cards: twoCards }).catch(() => undefined);
    expect(await db.cards.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });
});

describe('resetProgress details', () => {
  it('clears stage and answer time of every card of the set but keeps the stars', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: threeCards }, 1);
    const [a, b, c] = await listCards(id);
    await setCardStage(a.id, 1, 10);
    await setCardStage(b.id, 2, 20);
    await setCardStage(c.id, 4, 30);
    await toggleStar(b.id);
    await completeRound(id);
    await completeRound(id);
    await resetProgress(id);
    const cards = await listCards(id);
    expect(cards.map((x) => [x.stage, x.lastAnsweredAt, x.starred])).toEqual([
      [0, undefined, false],
      [0, undefined, true],
      [0, undefined, false],
    ]);
    expect((await getSet(id))?.learnRound).toBe(1);
  });
});

describe('setCardStage and unknown ids', () => {
  it('setCardStage records when the card was answered', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate] = await listCards(id);
    await setCardStage(gate.id, 2, 500);
    expect(await db.cards.get(gate.id)).toMatchObject({ stage: 2, lastAnsweredAt: 500 });
  });

  it('writes to an unknown card or set are ignored, not created', async () => {
    await setCardStage('missing', 2, 500);
    await toggleStar('missing');
    await completeRound('missing');
    await markStudied('missing', 1);
    await resetProgress('missing');
    await deleteSet('missing');
    expect(await db.cards.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
  });
});

describe('listSetSummaries details', () => {
  it('ranks a never-studied set by updatedAt against studied sets and still lists empty sets', async () => {
    const studied = await createSet({ title: 'Studied', definitionLang: 'sk', cards: twoCards }, 1000);
    await markStudied(studied, 3000);
    const [gate] = await listCards(studied);
    await setCardStage(gate.id, 4, 1);
    await createSet({ title: 'Fresh', definitionLang: 'sk', cards: twoCards }, 5000);
    await createSet({ title: 'Empty', definitionLang: 'sk', cards: [] }, 100);
    const summaries = await listSetSummaries();
    expect(summaries.map((s) => [s.set.title, s.total, s.counts.mastered, s.counts.notStudied])).toEqual([
      ['Fresh', 2, 0, 2],
      ['Studied', 2, 1, 1],
      ['Empty', 0, 0, 0],
    ]);
  });
});

describe('concurrent writes', () => {
  it('two quick star toggles cancel out', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate] = await listCards(id);
    await Promise.all([toggleStar(gate.id), toggleStar(gate.id)]);
    expect((await db.cards.get(gate.id))?.starred).toBe(false);
  });

  it('round completions fired together are all counted', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    await Promise.all([completeRound(id), completeRound(id), completeRound(id)]);
    expect((await getSet(id))?.learnRound).toBe(4);
  });
});

describe('atomic writes', () => {
  it('createSet leaves no half-written set when the cards cannot be saved', async () => {
    await expect(
      createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'ok', definition: 'ok' }, { term: unstorable, definition: 'd' }] }),
    ).rejects.toBeDefined();
    expect(await db.sets.count()).toBe(0);
    expect(await db.cards.count()).toBe(0);
  });

  it('updateSet rolls back its deletions and title change when writing the cards fails', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const [gate] = await listCards(id);
    await expect(
      updateSet(id, { title: 'NEW', definitionLang: 'cs', cards: [{ id: gate.id, term: unstorable, definition: 'd' }] }),
    ).rejects.toBeDefined();
    expect((await listCards(id)).map((c) => c.term)).toEqual(['gate', 'delay']);
    expect(await getSet(id)).toMatchObject({ title: 'T', definitionLang: 'sk' });
  });
});

describe('settings details', () => {
  it('fills missing flashcard options from the defaults and the last save of a key wins', async () => {
    await saveSetting('flashcards', { autoplay: true } as FlashcardPrefs); // an older, partial row
    expect((await loadSettings()).flashcards).toEqual({ ...DEFAULT_SETTINGS.flashcards, autoplay: true });
    await saveSetting('theme', 'dark');
    await saveSetting('theme', 'light');
    expect((await loadSettings()).theme).toBe('light');
  });
});

describe('persistent storage (spec 6.3)', () => {
  it('createSet asks the browser for persistent storage', async () => {
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => false, persist } });
    try {
      await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
      await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    } finally {
      delete (navigator as unknown as { storage?: unknown }).storage;
    }
  });
});

describe('useSetData', () => {
  it('goes from loading to found, follows writes in one snapshot and reports a deleted set as not found', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const { result, rerender } = renderHook(() => useSetData(id));
    expect(result.current).toMatchObject({ loading: true, set: undefined });
    const loadingCards = result.current.cards;
    rerender();
    expect(result.current.cards).toBe(loadingCards);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.set?.title).toBe('T');
    expect(result.current.cards).toHaveLength(2);

    await act(async () => {
      await updateSet(id, { title: 'T2', definitionLang: 'sk', cards: [twoCards[0]] });
    });
    await waitFor(() => expect(result.current.set?.title).toBe('T2'));
    expect(result.current.cards).toHaveLength(1);

    await act(async () => {
      await deleteSet(id);
    });
    await waitFor(() => expect(result.current.set).toBeUndefined());
    expect(result.current.loading).toBe(false);
    expect(result.current.cards).toBe(loadingCards);
  });

  it('reports an unknown id as not found, not as loading', async () => {
    const { result } = renderHook(() => useSetData('missing'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.set).toBeUndefined();
    expect(result.current.cards).toEqual([]);
  });

  it('treats a missing id (editor in create mode) as not found without throwing', async () => {
    const { result } = renderHook(() => useSetData(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.set).toBeUndefined();
  });
});
