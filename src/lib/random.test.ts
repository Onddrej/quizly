import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from './random';
import { newId } from './id';

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(values);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('shuffle', () => {
  it('keeps every item, does not mutate the input and is reproducible with a seed', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const first = shuffle(input, createRng(7));
    expect([...first].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(shuffle(input, createRng(7))).toEqual(first);
  });
});

describe('newId', () => {
  it('returns distinct non-empty ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
});
