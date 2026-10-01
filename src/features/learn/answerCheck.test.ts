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
