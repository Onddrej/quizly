import { describe, expect, it } from 'vitest';
import { countStatuses, statusOf } from './progress';

describe('statusOf', () => {
  it('maps stages to the three displayed statuses', () => {
    expect(statusOf(0)).toBe('not-studied');
    expect(statusOf(1)).toBe('learning');
    expect(statusOf(2)).toBe('learning');
    expect(statusOf(3)).toBe('learning');
    expect(statusOf(4)).toBe('mastered');
  });
});

describe('countStatuses', () => {
  it('counts cards per status', () => {
    const cards = [{ stage: 0 }, { stage: 1 }, { stage: 3 }, { stage: 4 }, { stage: 4 }] as const;
    expect(countStatuses(cards)).toEqual({ mastered: 2, learning: 2, notStudied: 1 });
  });
});
