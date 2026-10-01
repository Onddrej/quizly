import { describe, expect, it } from 'vitest';
import type { Card } from '../../db/types';
import { createRng } from '../../lib/random';
import { normalize } from '../../lib/text';
import {
  answer,
  currentCardId,
  isRoundFinished,
  isSetMastered,
  pickChoices,
  questionTypeFor,
  selectRoundCards,
  stageAfter,
  startRound,
  summarizeRound,
  type RoundState,
} from './engine';

function card(id: string, overrides: Partial<Card> = {}): Card {
  return { id, setId: 's1', term: `term-${id}`, definition: `def-${id}`, position: 0, starred: false, stage: 0, ...overrides };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

describe('questionTypeFor', () => {
  it.each([
    [0, 'choice'],
    [1, 'choice'],
    [2, 'write-term'],
    [3, 'write-definition'],
    [4, null],
  ] as const)('stage %i asks %s', (stage, type) => {
    expect(questionTypeFor(stage)).toBe(type);
  });
});

describe('stageAfter', () => {
  it.each([
    [0, true, 2],
    [1, true, 2],
    [2, true, 3],
    [3, true, 4],
    [0, false, 1],
    [1, false, 1],
    [2, false, 1],
    [3, false, 2],
  ] as const)('stage %i, correct=%s -> %i', (stage, correct, expected) => {
    expect(stageAfter(stage, correct)).toBe(expected);
  });
});

describe('selectRoundCards', () => {
  it('skips mastered cards, takes in-progress cards first (oldest answer first), then new cards in set order, max 7', () => {
    const cards = [
      card('c0', { position: 0, stage: 4 }),
      card('c1', { position: 1 }),
      card('c2', { position: 2, stage: 2, lastAnsweredAt: 300 }),
      card('c3', { position: 3, stage: 1, lastAnsweredAt: 100 }),
      card('c4', { position: 4 }),
      card('c5', { position: 5 }),
      card('c6', { position: 6 }),
      card('c7', { position: 7 }),
      card('c8', { position: 8 }),
    ];
    expect(selectRoundCards(cards).map((c) => c.id)).toEqual(['c3', 'c2', 'c1', 'c4', 'c5', 'c6', 'c7']);
  });
});

describe('startRound', () => {
  it('queues every selected card once and is reproducible with a seed', () => {
    const cards = [card('c1', { position: 1 }), card('c2', { position: 2 }), card('c3', { position: 3 })];
    const a = startRound(cards, createRng(1));
    const b = startRound(cards, createRng(1));
    expect(a.queue).toEqual(b.queue);
    expect([...a.queue].sort()).toEqual(['c1', 'c2', 'c3']);
    expect(a.stages).toEqual({ c1: 0, c2: 0, c3: 0 });
    expect(a.startStages).toEqual(a.stages);
  });
});

describe('answer', () => {
  const base = (): RoundState => ({
    cardIds: ['a', 'b'],
    queue: ['a', 'b'],
    attempts: {},
    firstTry: {},
    stages: { a: 0, b: 2 },
    startStages: { a: 0, b: 2 },
  });

  it('moves a correct card forward and out of the queue', () => {
    const { state, stage } = answer(base(), true);
    expect(stage).toBe(2);
    expect(state.queue).toEqual(['b']);
    expect(state.firstTry).toEqual({ a: true });
    expect(state.stages.a).toBe(2);
  });

  it('re-queues a wrong card at the end of the round', () => {
    const { state, stage } = answer(base(), false);
    expect(stage).toBe(1);
    expect(state.queue).toEqual(['b', 'a']);
    expect(state.firstTry).toEqual({ a: false });
  });

  it('asks one card at most 3 times per round', () => {
    let state: RoundState = { ...base(), cardIds: ['a'], queue: ['a'] };
    state = answer(state, false).state;
    expect(state.queue).toEqual(['a']);
    state = answer(state, false).state;
    expect(state.queue).toEqual(['a']);
    state = answer(state, false).state;
    expect(state.queue).toEqual([]);
    expect(isRoundFinished(state)).toBe(true);
  });

  it('keeps the first-try result after a retry', () => {
    let state: RoundState = { ...base(), cardIds: ['a'], queue: ['a'] };
    state = answer(state, false).state;
    state = answer(state, true).state;
    expect(state.firstTry.a).toBe(false);
    expect(state.stages.a).toBe(2);
  });

  it('throws when the round is already finished', () => {
    expect(() => answer({ ...base(), queue: [] }, true)).toThrow('Round is already finished');
  });
});

describe('summarizeRound', () => {
  it('counts first-try correct answers and newly mastered cards', () => {
    const state: RoundState = {
      cardIds: ['a', 'b', 'c'],
      queue: [],
      attempts: { a: 1, b: 2, c: 1 },
      firstTry: { a: true, b: false, c: true },
      stages: { a: 4, b: 2, c: 3 },
      startStages: { a: 3, b: 1, c: 2 },
    };
    const summary = summarizeRound(state);
    expect(summary.total).toBe(3);
    expect(summary.correctFirstTry).toBe(2);
    expect(summary.newlyMastered).toEqual(['a']);
    expect(summary.results).toEqual([
      { cardId: 'a', stage: 4, firstTry: true },
      { cardId: 'b', stage: 2, firstTry: false },
      { cardId: 'c', stage: 3, firstTry: true },
    ]);
  });
});

describe('pickChoices', () => {
  const cards = [
    card('c1', { definition: 'batožina' }),
    card('c2', { definition: 'odchod' }),
    card('c3', { definition: 'colnica' }),
    card('c4', { definition: 'brána' }),
    card('c5', { definition: 'meškanie' }),
  ];

  it('returns the correct definition plus 3 unique distractors', () => {
    const choices = pickChoices(cards[0], cards, createRng(7));
    expect(choices).toHaveLength(4);
    expect(choices).toContain('batožina');
    expect(new Set(choices).size).toBe(4);
  });

  it('offers fewer options in small sets', () => {
    expect(pickChoices(cards[0], cards.slice(0, 2), createRng(1))).toHaveLength(2);
  });

  it('skips distractors that read the same as the correct definition', () => {
    const duplicates = [card('x1', { definition: 'cesta' }), card('x2', { definition: 'Cesta' }), card('x3', { definition: 'let' })];
    expect(pickChoices(duplicates[0], duplicates, createRng(3)).sort()).toEqual(['cesta', 'let']);
  });
});

describe('isSetMastered', () => {
  it('is true only when every card is at stage 4', () => {
    expect(isSetMastered([card('a', { stage: 4 }), card('b', { stage: 4 })])).toBe(true);
    expect(isSetMastered([card('a', { stage: 4 }), card('b', { stage: 3 })])).toBe(false);
    expect(isSetMastered([])).toBe(false);
  });
});

describe('selectRoundCards (extra)', () => {
  it('breaks lastAnsweredAt ties by set position, whatever order the cards arrive in', () => {
    const cards = [
      card('late', { position: 5, stage: 2, lastAnsweredAt: 100 }),
      card('early', { position: 1, stage: 3, lastAnsweredAt: 100 }),
    ];
    expect(selectRoundCards(cards).map((c) => c.id)).toEqual(['early', 'late']);
  });

  it('treats an in-progress card without lastAnsweredAt as the longest unseen', () => {
    const cards = [card('seen', { position: 0, stage: 2, lastAnsweredAt: 100 }), card('never', { position: 1, stage: 1 })];
    expect(selectRoundCards(cards).map((c) => c.id)).toEqual(['never', 'seen']);
  });

  it('orders new cards by set position even when they arrive out of order', () => {
    const cards = [card('p3', { position: 3 }), card('p1', { position: 1 }), card('p2', { position: 2 })];
    expect(selectRoundCards(cards).map((c) => c.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('honours a custom size, returns nothing when all is mastered and leaves its input alone', () => {
    const cards = [card('a', { position: 2 }), card('b', { position: 1 })];
    const before = structuredClone(cards);
    expect(selectRoundCards(cards, 1).map((c) => c.id)).toEqual(['b']);
    expect(cards).toEqual(before);
    expect(selectRoundCards([card('m', { stage: 4 })])).toEqual([]);
  });
});

describe('startRound (extra)', () => {
  const cards = Array.from({ length: 7 }, (_, i) => card(`c${i}`, { position: i }));

  it('starts every picked card at its saved stage and lists them in selection order', () => {
    const mixed = [
      card('a', { position: 0, stage: 2, lastAnsweredAt: 5 }),
      card('b', { position: 1, stage: 3, lastAnsweredAt: 6 }),
      card('c', { position: 2, stage: 1, lastAnsweredAt: 7 }),
      card('d', { position: 3 }),
      card('done', { position: 4, stage: 4 }),
    ];
    const round = startRound(mixed, createRng(1));
    expect(round.cardIds).toEqual(['a', 'b', 'c', 'd']);
    expect(round.stages).toEqual({ a: 2, b: 3, c: 1, d: 0 });
    expect(round.startStages).toEqual({ a: 2, b: 3, c: 1, d: 0 });
  });

  it('honours a custom round size', () => {
    expect(startRound(cards, createRng(1), 3).cardIds).toEqual(['c0', 'c1', 'c2']);
  });

  it('shuffles the queue, and the same seed gives the same order', () => {
    const selectionOrder = cards.map((c) => c.id).join();
    const orders = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) orders.add(startRound(cards, createRng(seed)).queue.join());
    expect(orders.size).toBeGreaterThan(1);
    expect([...orders].some((order) => order !== selectionOrder)).toBe(true);
    expect(startRound(cards, createRng(3)).queue).toEqual(startRound(cards, createRng(3)).queue);
  });
});

describe('answer, currentCardId and isRoundFinished (extra)', () => {
  const base = (): RoundState => ({
    cardIds: ['a', 'b'],
    queue: ['a', 'b'],
    attempts: {},
    firstTry: {},
    stages: { a: 0, b: 2 },
    startStages: { a: 0, b: 2 },
  });

  it('never touches the state it receives', () => {
    const frozen = deepFreeze(base());
    expect(() => answer(frozen, true)).not.toThrow();
    expect(() => answer(frozen, false)).not.toThrow();
    expect(frozen).toEqual(base());
  });

  it('works out the next stage from the current stage, not from the stage the round started at', () => {
    // 3 -> 2 after a mistake, so the retry is a write-term question: a right answer gives 3 again, never 4.
    const start: RoundState = { cardIds: ['a'], queue: ['a'], attempts: {}, firstTry: {}, stages: { a: 3 }, startStages: { a: 3 } };
    let result = answer(start, false);
    expect(result.stage).toBe(2);
    result = answer(result.state, true);
    expect(result.stage).toBe(3);
    expect(result.state.stages.a).toBe(3);
    expect(isRoundFinished(result.state)).toBe(true);
  });

  it('counts the retries of each card separately', () => {
    let state: RoundState = { cardIds: ['a', 'b'], queue: ['a', 'b'], attempts: {}, firstTry: {}, stages: { a: 0, b: 0 }, startStages: { a: 0, b: 0 } };
    const asked: string[] = [];
    while (!isRoundFinished(state)) {
      asked.push(currentCardId(state)!);
      state = answer(state, false).state;
    }
    expect(asked).toEqual(['a', 'b', 'a', 'b', 'a', 'b']);
  });

  it('currentCardId follows the head of the queue and isRoundFinished only turns true at the end', () => {
    const start = base();
    expect(currentCardId(start)).toBe('a');
    expect(isRoundFinished(start)).toBe(false);
    const middle = answer(start, true).state;
    expect(currentCardId(middle)).toBe('b');
    expect(isRoundFinished(middle)).toBe(false);
    const end = answer(middle, true).state;
    expect(currentCardId(end)).toBeNull();
    expect(isRoundFinished(end)).toBe(true);
  });
});

describe('summarizeRound (extra)', () => {
  it('does not report a card that was already mastered when the round started', () => {
    const state: RoundState = {
      cardIds: ['a', 'b'],
      queue: [],
      attempts: { a: 1, b: 1 },
      firstTry: { a: true, b: true },
      stages: { a: 4, b: 4 },
      startStages: { a: 4, b: 3 },
    };
    expect(summarizeRound(state).newlyMastered).toEqual(['b']);
  });

  it('reports a card that was never answered as not correct on the first try', () => {
    const state: RoundState = { cardIds: ['a'], queue: ['a'], attempts: {}, firstTry: {}, stages: { a: 0 }, startStages: { a: 0 } };
    const summary = summarizeRound(state);
    expect(summary.correctFirstTry).toBe(0);
    expect(summary.results).toEqual([{ cardId: 'a', stage: 0, firstTry: false }]);
  });
});

describe('pickChoices (extra)', () => {
  const words = ['batožina', 'odchod', 'colnica', 'brána', 'meškanie'];
  const cards = words.map((definition, i) => card(`c${i + 1}`, { definition }));

  it('does not always put the correct answer in the same place', () => {
    const slots = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) slots.add(pickChoices(cards[0], cards, createRng(seed)).indexOf('batožina'));
    expect([...slots].sort()).toEqual([0, 1, 2, 3]);
  });

  it('draws its distractors at random from the other cards', () => {
    const offered = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) pickChoices(cards[0], cards, createRng(seed)).forEach((choice) => offered.add(choice));
    expect(offered).toEqual(new Set(words));
  });

  it('is reproducible with a seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      expect(pickChoices(cards[0], cards, createRng(seed))).toEqual(pickChoices(cards[0], cards, createRng(seed)));
    }
  });

  it('never offers the same definition twice, also among the distractors', () => {
    const synonyms = [
      card('t', { definition: 'dom' }),
      card('s1', { definition: 'veľký' }),
      card('s2', { definition: 'Veľký' }),
      card('s3', { definition: 'malý' }),
      card('s4', { definition: 'rýchly' }),
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const choices = pickChoices(synonyms[0], synonyms, createRng(seed));
      expect(choices).toHaveLength(4);
      expect(new Set(choices.map(normalize)).size).toBe(4);
    }
  });

  it('compares the correct definition in its normalized form too', () => {
    const set = [card('x1', { definition: 'Brána' }), card('x2', { definition: 'brana' }), card('x3', { definition: 'let' })];
    expect(pickChoices(set[0], set, createRng(3)).sort()).toEqual(['Brána', 'let']);
  });

  it('offers only the correct definition when every card shares it (callers must cope)', () => {
    const same = [card('a', { definition: 'veľký' }), card('b', { definition: 'veľký' })];
    expect(pickChoices(same[0], same, createRng(1))).toEqual(['veľký']);
  });

  it('honours a custom option count', () => {
    expect(pickChoices(cards[0], cards, createRng(1), 3)).toHaveLength(3);
  });
});
