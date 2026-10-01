import { describe, expect, it } from 'vitest';
import type { Card } from '../../db/types';
import { createRng } from '../../lib/random';
import {
  answer,
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
