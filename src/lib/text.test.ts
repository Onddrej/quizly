import { describe, expect, it } from 'vitest';
import { levenshtein, normalize, splitVariants } from './text';

describe('normalize', () => {
  it('lowercases, trims and strips diacritics', () => {
    expect(normalize('  Batožina ')).toBe('batozina');
  });
  it('turns typographic apostrophes into plain ones', () => {
    expect(normalize('Don’t')).toBe("don't");
  });
  it('collapses inner whitespace and strips edge punctuation', () => {
    expect(normalize('Hello,   World!')).toBe('hello, world');
    expect(normalize('"delay."')).toBe('delay');
  });
});

describe('levenshtein', () => {
  it('counts single-character edits', () => {
    expect(levenshtein('delay', 'delay')).toBe(0);
    expect(levenshtein('delay', 'delai')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('splitVariants', () => {
  it('splits on comma, slash and semicolon and drops empty parts', () => {
    expect(splitVariants('odchod, odlet')).toEqual(['odchod', 'odlet']);
    expect(splitVariants('trip / journey; voyage')).toEqual(['trip', 'journey', 'voyage']);
    expect(splitVariants('a,,b')).toEqual(['a', 'b']);
  });
});
