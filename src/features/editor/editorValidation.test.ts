import { describe, expect, it } from 'vitest';
import { validateDraft } from './editorValidation';

const row = (key: string, term: string, definition: string, id?: string) => ({ key, id, term, definition });

describe('validateDraft', () => {
  it('requires a title and at least one card', () => {
    const result = validateDraft('  ', [row('a', '', '')]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ title: 'Add a title', cards: 'Add at least one card' });
  });

  it('ignores empty rows and flags half-filled ones', () => {
    const result = validateDraft('Travel', [row('a', 'gate', ''), row('b', '', 'brána'), row('c', '', '')]);
    expect(result.ok).toBe(false);
    expect(result.errors.rows).toEqual({ a: { definition: 'Add a definition' }, b: { term: 'Add a term' } });
  });

  it('returns card drafts for valid input, keeping ids of existing cards', () => {
    const result = validateDraft('Travel', [row('a', 'gate', 'brána', 'card-1'), row('b', '', ''), row('c', 'delay', 'meškanie')]);
    expect(result.ok).toBe(true);
    expect(result.cards).toEqual([
      { id: 'card-1', term: 'gate', definition: 'brána' },
      { id: undefined, term: 'delay', definition: 'meškanie' },
    ]);
  });
});
