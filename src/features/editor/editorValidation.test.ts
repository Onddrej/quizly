import { describe, expect, it } from 'vitest';
import { validateDraft } from './editorValidation';

const row = (key: string, term: string, definition: string, id?: string, meaning = '', examples = '') => ({
  key,
  id,
  term,
  definition,
  meaning,
  examples,
});

describe('validateDraft', () => {
  it('requires a title and at least one card', () => {
    const result = validateDraft('  ', [row('a', '', '')]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ title: 'Add a title', cards: 'Add at least one card' });
  });

  it('ignores empty rows and flags half-filled ones', () => {
    const result = validateDraft('Travel', [row('a', 'gate', ''), row('b', '', 'brána'), row('c', '', '')]);
    expect(result.ok).toBe(false);
    expect(result.errors.rows).toEqual({ a: { definition: 'Add a translation' }, b: { term: 'Add a term' } });
  });

  it('returns card drafts for valid input, keeping ids of existing cards', () => {
    const result = validateDraft('Travel', [row('a', 'gate', 'brána', 'card-1'), row('b', '', ''), row('c', 'delay', 'meškanie')]);
    expect(result.ok).toBe(true);
    expect(result.cards).toEqual([
      { id: 'card-1', term: 'gate', definition: 'brána', meaning: '', examples: '' },
      { id: undefined, term: 'delay', definition: 'meškanie', meaning: '', examples: '' },
    ]);
  });
});

describe('validateDraft card details', () => {
  it('passes the definition and examples through untouched (the repository normalizes them)', () => {
    const result = validateDraft('Travel', [row('a', 'gate', 'brána', 'card-1', ' a door at an airport ', 'Gate 12.\n\nBoarding now.')]);
    expect(result.ok).toBe(true);
    expect(result.cards).toEqual([
      { id: 'card-1', term: 'gate', definition: 'brána', meaning: ' a door at an airport ', examples: 'Gate 12.\n\nBoarding now.' },
    ]);
  });

  it('asks for both a term and a translation when only a definition is filled', () => {
    const result = validateDraft('Travel', [row('a', '', '', undefined, 'a door at an airport')]);
    expect(result.ok).toBe(false);
    expect(result.errors.rows).toEqual({ a: { term: 'Add a term', definition: 'Add a translation' } });
    expect(result.errors.cards).toBeUndefined();
  });

  it('asks for both a term and a translation when only examples are filled', () => {
    const result = validateDraft('Travel', [row('a', '', '', undefined, '', 'Gate 12 is open.')]);
    expect(result.errors.rows).toEqual({ a: { term: 'Add a term', definition: 'Add a translation' } });
  });

  it('does not require the optional fields', () => {
    const result = validateDraft('Travel', [row('a', 'gate', 'brána')]);
    expect(result.ok).toBe(true);
  });

  it('treats a row whose four fields are blank as empty', () => {
    const result = validateDraft('Travel', [row('a', ' ', '  ', undefined, ' ', '\n ')]);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual({ cards: 'Add at least one card' });
    expect(result.cards).toEqual([]);
  });
});

describe('validateDraft whitespace-only fields in a filled row', () => {
  it('flags a whitespace-only translation instead of saving it blank', () => {
    const result = validateDraft('Travel', [row('a', 'gate', '   ')]);
    expect(result.ok).toBe(false);
    expect(result.errors.rows).toEqual({ a: { definition: 'Add a translation' } });
  });

  it('flags a whitespace-only term instead of saving it blank', () => {
    const result = validateDraft('Travel', [row('a', '  \t', 'brána')]);
    expect(result.ok).toBe(false);
    expect(result.errors.rows).toEqual({ a: { term: 'Add a term' } });
  });

  it('keys row errors by the editor row key, also for existing cards', () => {
    const result = validateDraft('Travel', [row('k1', 'gate', '', 'card-1')]);
    expect(result.errors.rows).toEqual({ k1: { definition: 'Add a translation' } });
  });
});
