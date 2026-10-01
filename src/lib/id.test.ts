import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns distinct non-empty ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    expect([...ids].every((id) => id.length > 0)).toBe(true);
  });
  it('still returns distinct ids when crypto.randomUUID is unavailable (non-secure context)', () => {
    vi.stubGlobal('crypto', {});
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    expect([...ids].every((id) => /^[0-9a-z]+-[0-9a-z]+$/.test(id))).toBe(true);
  });
});
