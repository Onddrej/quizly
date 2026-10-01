import { describe, expect, it } from 'vitest';
import { checkAnswer, typoAllowance } from './answerCheck';

describe('typoAllowance', () => {
  it('allows no typo up to 3 characters, 1 up to 7, then 2', () => {
    expect(typoAllowance(3)).toBe(0);
    expect(typoAllowance(4)).toBe(1);
    expect(typoAllowance(7)).toBe(1);
    expect(typoAllowance(8)).toBe(2);
  });
});

describe('checkAnswer', () => {
  it('accepts exact answers regardless of case and spacing', () => {
    expect(checkAnswer('delay', 'delay', 'english')).toBe('exact');
    expect(checkAnswer('  Delay ', 'delay', 'english')).toBe('exact');
  });

  it('ignores diacritics, also in Slovak', () => {
    expect(checkAnswer('batozina', 'batožina', 'other')).toBe('exact');
    expect(checkAnswer('meskanie', 'meškanie', 'other')).toBe('exact');
  });

  it('accepts any variant separated by comma, slash or semicolon', () => {
    expect(checkAnswer('odlet', 'odchod, odlet', 'other')).toBe('exact');
    expect(checkAnswer('odchod', 'odchod, odlet', 'other')).toBe('exact');
    expect(checkAnswer('odchod, odlet', 'odchod, odlet', 'other')).toBe('exact');
    expect(checkAnswer('journey', 'trip / journey', 'english')).toBe('exact');
  });

  it('treats a leading "to", "a", "an" or "the" as optional in English only', () => {
    expect(checkAnswer('go', 'to go', 'english')).toBe('exact');
    expect(checkAnswer('to go', 'go', 'english')).toBe('exact');
    expect(checkAnswer('the gate', 'gate', 'english')).toBe('exact');
    expect(checkAnswer('pes', 'to pes', 'other')).toBe('wrong');
  });

  it('accepts small typos according to the expected length', () => {
    expect(checkAnswer('delai', 'delay', 'english')).toBe('typo');
    expect(checkAnswer('gatr', 'gate', 'english')).toBe('typo');
    expect(checkAnswer('accomodation', 'accommodation', 'english')).toBe('typo');
    expect(checkAnswer('acomodation', 'accommodation', 'english')).toBe('typo');
    expect(checkAnswer('acomodaton', 'accommodation', 'english')).toBe('wrong');
  });

  it('requires short words to match exactly', () => {
    expect(checkAnswer('cut', 'cat', 'english')).toBe('wrong');
    expect(checkAnswer('ox', 'ax', 'english')).toBe('wrong');
  });

  it('rejects empty answers', () => {
    expect(checkAnswer('   ', 'gate', 'english')).toBe('wrong');
  });
});

describe('checkAnswer: additional pins', () => {
  it('treats "a" and "an" as optional leading articles, in both directions', () => {
    expect(checkAnswer('lot', 'a lot', 'english')).toBe('exact');
    expect(checkAnswer('apple', 'an apple', 'english')).toBe('exact');
    expect(checkAnswer('a lot', 'lot', 'english')).toBe('exact');
    expect(checkAnswer('an apple', 'apple', 'english')).toBe('exact');
  });

  it('strips only a whole leading word, never the start of a word or a middle article', () => {
    expect(checkAnswer('mato', 'tomato', 'english')).toBe('wrong');
    expect(checkAnswer('atre', 'theatre', 'english')).toBe('wrong');
    expect(checkAnswer('look at sky', 'look at the sky', 'english')).toBe('wrong');
    expect(checkAnswer('a', 'a', 'english')).toBe('exact');
    expect(checkAnswer('an', 'a', 'english')).toBe('wrong');
  });

  it('does not strip prefixes from the typed answer when the language is other', () => {
    expect(checkAnswer('to pes', 'pes', 'other')).toBe('wrong');
  });

  it('keys the typo allowance to the expected text, not to what was typed', () => {
    expect(checkAnswer('cats', 'cat', 'english')).toBe('wrong');
    expect(checkAnswer('cat', 'cats', 'english')).toBe('typo');
  });

  it('allows a typo in any variant and after a prefix', () => {
    expect(checkAnswer('odchot', 'odchod, odlet', 'other')).toBe('typo');
    expect(checkAnswer('psuk', 'pes, psík', 'other')).toBe('typo');
    expect(checkAnswer('the gat', 'gate', 'english')).toBe('typo');
    expect(checkAnswer('gat', 'the gate', 'english')).toBe('typo');
  });

  it('normalizes every variant, not only the whole text', () => {
    expect(checkAnswer('odchod', 'Odchod, Odlet', 'other')).toBe('exact');
    expect(checkAnswer('meskanie', 'omeskanie, meškanie', 'other')).toBe('exact');
  });
});
