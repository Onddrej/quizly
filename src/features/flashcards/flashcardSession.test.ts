import { describe, expect, it } from 'vitest';
import { flashcardReducer, initialFlashcardState, isFinished, tally } from './flashcardSession';

describe('flashcardReducer', () => {
  const start = () => initialFlashcardState(['a', 'b', 'c']);

  it('flips the current card and unflips on sort', () => {
    let state = flashcardReducer(start(), { type: 'flip' });
    expect(state.flipped).toBe(true);
    state = flashcardReducer(state, { type: 'sort', result: 'know' });
    expect(state).toMatchObject({ index: 1, flipped: false, results: { a: 'know' }, history: ['a'] });
  });

  it('undo reverts the last sort', () => {
    let state = flashcardReducer(start(), { type: 'sort', result: 'learning' });
    state = flashcardReducer(state, { type: 'undo' });
    expect(state).toMatchObject({ index: 0, results: {}, history: [] });
    expect(flashcardReducer(state, { type: 'undo' })).toBe(state);
  });

  it('finishes after the last card and tallies results', () => {
    let state = start();
    state = flashcardReducer(state, { type: 'sort', result: 'know' });
    state = flashcardReducer(state, { type: 'sort', result: 'learning' });
    expect(isFinished(state)).toBe(false);
    state = flashcardReducer(state, { type: 'sort', result: 'know' });
    expect(isFinished(state)).toBe(true);
    expect(tally(state)).toEqual({ know: 2, learning: 1, learningIds: ['b'] });
    expect(flashcardReducer(state, { type: 'sort', result: 'know' })).toBe(state);
  });

  it('start resets the session with a new order', () => {
    const state = flashcardReducer(flashcardReducer(start(), { type: 'sort', result: 'know' }), { type: 'start', order: ['b'] });
    expect(state).toEqual(initialFlashcardState(['b']));
  });

  it('an empty deck is never finished', () => {
    expect(isFinished(initialFlashcardState([]))).toBe(false);
  });
});
