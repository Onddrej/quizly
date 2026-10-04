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

describe('flashcardReducer flip, undo, tally and start details', () => {
  const start = () => initialFlashcardState(['a', 'b', 'c']);
  const sort = (s: ReturnType<typeof start>, result: 'know' | 'learning') => flashcardReducer(s, { type: 'sort', result });

  it('flip toggles back and forth', () => {
    const once = flashcardReducer(start(), { type: 'flip' });
    expect(flashcardReducer(once, { type: 'flip' }).flipped).toBe(false);
  });

  it('flip does nothing once the deck is finished or empty', () => {
    let s = start();
    for (let i = 0; i < 3; i++) s = sort(s, 'know');
    expect(flashcardReducer(s, { type: 'flip' })).toBe(s);
    const empty = initialFlashcardState([]);
    expect(flashcardReducer(empty, { type: 'flip' })).toBe(empty);
  });

  it('undo steps back one card at a time, newest first', () => {
    let s = sort(sort(sort(start(), 'know'), 'learning'), 'know');
    s = flashcardReducer(s, { type: 'undo' });
    expect(s).toMatchObject({ index: 2, history: ['a', 'b'] });
    expect(s.results).toEqual({ a: 'know', b: 'learning' });
    expect(isFinished(s)).toBe(false);
    s = flashcardReducer(s, { type: 'undo' });
    expect(s).toMatchObject({ index: 1, history: ['a'] });
    expect(s.results).toEqual({ a: 'know' });
  });

  it('undo after finishing reopens the last card, and a flipped card is shown front side again', () => {
    let s = sort(sort(sort(start(), 'know'), 'know'), 'learning');
    expect(isFinished(s)).toBe(true);
    s = flashcardReducer(flashcardReducer(s, { type: 'undo' }), { type: 'flip' });
    expect(s.flipped).toBe(true);
    s = flashcardReducer(s, { type: 'undo' });
    expect(s.flipped).toBe(false);
    expect(s.index).toBe(1);
  });

  it('undo clears the result so the card can be sorted the other way', () => {
    let s = sort(start(), 'learning');
    s = sort(flashcardReducer(s, { type: 'undo' }), 'know');
    expect(s.results).toEqual({ a: 'know' });
    expect(tally(s)).toEqual({ know: 1, learning: 0, learningIds: [] });
  });

  it('tally lists the learning ids in the order they were sorted', () => {
    let s = initialFlashcardState(['a', 'b', 'c', 'd']);
    s = sort(sort(sort(sort(s, 'learning'), 'know'), 'learning'), 'learning');
    expect(tally(s)).toEqual({ know: 1, learning: 3, learningIds: ['a', 'c', 'd'] });
  });

  it('sort stores the id of the card at the current index, not the first one', () => {
    let s = sort(start(), 'know');
    s = sort(s, 'learning');
    expect(s.history).toEqual(['a', 'b']);
    expect(s.results).toEqual({ a: 'know', b: 'learning' });
  });

  it('a start with a new order does not keep flipped state', () => {
    const flipped = flashcardReducer(start(), { type: 'flip' });
    expect(flashcardReducer(flipped, { type: 'start', order: ['x'] }).flipped).toBe(false);
  });
});
