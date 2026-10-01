import { describe, expect, it } from 'vitest';
import { createRng, shuffle } from './random';

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(values);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
  it('produces different streams for different seeds', () => {
    const take = (seed: number) => {
      const r = createRng(seed);
      return Array.from({ length: 5 }, () => r());
    };
    expect(take(1)).not.toEqual(take(2));
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
  it('really reorders: all six orders of three items show up across seeds', () => {
    const orders = new Set(Array.from({ length: 200 }, (_, seed) => shuffle([1, 2, 3], createRng(seed)).join('')));
    expect(orders.size).toBe(6);
  });
  it('copes with empty and single-item input', () => {
    expect(shuffle([], createRng(1))).toEqual([]);
    const one = ['x'];
    const result = shuffle(one, createRng(1));
    expect(result).toEqual(['x']);
    expect(result).not.toBe(one);
  });
});
