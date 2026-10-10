import { describe, expect, it } from 'vitest';
import { BLANK, maskTerm } from './hint';

describe('maskTerm', () => {
  it('blanks the term and its common inflections', () => {
    expect(maskTerm('She acknowledged that she had made a mistake.', 'acknowledge')).toBe(`She ${BLANK} that she had made a mistake.`);
    expect(maskTerm('He never acknowledges my emails.', 'acknowledge')).toBe(`He never ${BLANK} my emails.`);
    expect(maskTerm('Acknowledging a problem is the first step.', 'acknowledge')).toBe(`${BLANK} a problem is the first step.`);
  });

  it('handles verbs ending in y, a doubled final consonant and plurals', () => {
    expect(maskTerm('Scientists carried out tests, and carries on.', 'carry')).toBe(`Scientists ${BLANK} out tests, and ${BLANK} on.`);
    expect(maskTerm('They stopped, then stop again.', 'stop')).toBe(`They ${BLANK}, then ${BLANK} again.`);
    expect(maskTerm('The drawbacks are clear.', 'drawback')).toBe(`The ${BLANK} are clear.`);
    expect(maskTerm('It is a notorious liar, notoriously so.', 'notorious')).toBe(`It is a ${BLANK} liar, ${BLANK} so.`);
  });

  it('is case-insensitive', () => {
    expect(maskTerm('GIST and Gist and gist', 'gist')).toBe(`${BLANK} and ${BLANK} and ${BLANK}`);
  });

  it('only blanks whole words', () => {
    expect(maskTerm('The fact is that people react to it.', 'act')).toBe('The fact is that people react to it.');
  });

  it('blanks every content word of a phrase and keeps small particles', () => {
    expect(maskTerm('Scientists carried out a series of tests.', 'carry out')).toBe(`Scientists ${BLANK} out a series of tests.`);
    expect(maskTerm('She will come up with a solution.', 'come up with')).toBe(`She will ${BLANK} up with a solution.`);
    expect(maskTerm('They cut back on costs and are cutting back on waste.', 'cut back on')).toBe(`They ${BLANK} ${BLANK} on costs and are ${BLANK} ${BLANK} on waste.`);
  });

  it('does not know irregular forms: they stay visible', () => {
    expect(maskTerm('She came up with a solution.', 'come up with')).toBe('She came up with a solution.');
  });

  it('ignores a leading "to", a part-of-speech tag and placeholders like sth/sb', () => {
    expect(maskTerm('He got offended easily and gets offended often.', 'to get offended')).toBe(`He got ${BLANK} easily and ${BLANK} ${BLANK} often.`);
    expect(maskTerm('The plan was a bargain and a good bargain.', 'bargain, noun')).toBe(`The plan was a ${BLANK} and a good ${BLANK}.`);
    expect(maskTerm('She felt faint in the heat.', 'faint (verb)')).toBe(`She felt ${BLANK} in the heat.`);
    expect(maskTerm('I stumbled upon an old photo.', 'stumble across/on/upon sth/sb')).toBe(`I ${BLANK} ${BLANK} an old photo.`);
  });

  it('blanks both halves of a hyphenated term', () => {
    expect(maskTerm('Known for its cutting-edge technology.', 'cutting-edge')).toBe(`Known for its ${BLANK}-${BLANK} technology.`);
  });

  it('returns the text unchanged when the term does not occur', () => {
    expect(maskTerm('Nothing to hide here.', 'luggage')).toBe('Nothing to hide here.');
  });

  it('does nothing for an empty term', () => {
    expect(maskTerm('Some text.', '')).toBe('Some text.');
    expect(maskTerm('Some text.', '   ')).toBe('Some text.');
  });
});
