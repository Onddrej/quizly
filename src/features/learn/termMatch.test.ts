import { describe, expect, it } from 'vitest';
import { splitByTerm } from './termMatch';

const joined = (parts: ReturnType<typeof splitByTerm>) => parts.map((p) => p.text).join('');
const marked = (parts: ReturnType<typeof splitByTerm>) => parts.filter((p) => p.match).map((p) => p.text);

describe('splitByTerm', () => {
  it('marks the term and its common inflections', () => {
    const parts = splitByTerm('She acknowledged it, and he acknowledges it. Acknowledging helps.', 'acknowledge');
    expect(marked(parts)).toEqual(['acknowledged', 'acknowledges', 'Acknowledging']);
  });

  it('splits into the text before, the match and the text after', () => {
    expect(splitByTerm('The exam is the final hurdle.', 'hurdle')).toEqual([
      { text: 'The exam is the final ', match: false },
      { text: 'hurdle', match: true },
      { text: '.', match: false },
    ]);
  });

  it('always rebuilds the original text', () => {
    const text = 'Stop! They stopped, then stop again; stopping is hard.';
    expect(joined(splitByTerm(text, 'stop'))).toBe(text);
  });

  it('handles verbs ending in y, a doubled final consonant and plurals', () => {
    expect(marked(splitByTerm('He carried it; she carries on.', 'carry'))).toEqual(['carried', 'carries']);
    expect(marked(splitByTerm('They stopped.', 'stop'))).toEqual(['stopped']);
    expect(marked(splitByTerm('The drawbacks are clear.', 'drawback'))).toEqual(['drawbacks']);
    expect(marked(splitByTerm('She was notoriously late.', 'notorious'))).toEqual(['notoriously']);
  });

  it('only matches whole words', () => {
    expect(marked(splitByTerm('The fact is that people react to it.', 'act'))).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(marked(splitByTerm('GIST and Gist and gist', 'gist'))).toEqual(['GIST', 'Gist', 'gist']);
  });

  it('marks the content words of a phrase and leaves particles alone', () => {
    expect(marked(splitByTerm('Scientists carried out a series of tests.', 'carry out'))).toEqual(['carried']);
    expect(marked(splitByTerm('They cut back on costs.', 'cut back on'))).toEqual(['cut', 'back']);
  });

  it('ignores a leading "to", a part-of-speech tag and placeholders like sth/sb', () => {
    expect(marked(splitByTerm('He gets offended easily.', 'to get offended'))).toEqual(['gets', 'offended']);
    expect(marked(splitByTerm('A good bargain.', 'bargain, noun'))).toEqual(['bargain']);
    expect(marked(splitByTerm('She felt faint.', 'faint (verb)'))).toEqual(['faint']);
    expect(marked(splitByTerm('I stumbled upon it.', 'stumble across/on/upon sth/sb'))).toEqual(['stumbled', 'upon']);
  });

  it('marks both halves of a hyphenated term', () => {
    expect(marked(splitByTerm('Its cutting-edge technology.', 'cutting-edge'))).toEqual(['cutting', 'edge']);
  });

  it('does not know irregular forms', () => {
    expect(marked(splitByTerm('She came up with it.', 'come up with'))).toEqual([]);
  });

  it('returns the whole text unmarked when nothing matches or the term is empty', () => {
    expect(splitByTerm('Nothing to see.', 'luggage')).toEqual([{ text: 'Nothing to see.', match: false }]);
    expect(splitByTerm('Some text.', '  ')).toEqual([{ text: 'Some text.', match: false }]);
  });

  it('returns no segments for empty text', () => {
    expect(splitByTerm('', 'term')).toEqual([]);
  });
});
