import { describe, expect, it } from 'vitest';
import { parsePastedList } from './pasteParser';

describe('parsePastedList', () => {
  it('splits on a tab first', () => {
    expect(parsePastedList('luggage\tbatožina').pairs).toEqual([{ term: 'luggage', definition: 'batožina' }]);
  });

  it('splits on a spaced dash (hyphen, en dash, em dash)', () => {
    const { pairs } = parsePastedList('gate - brána\nlayover – prestup\ndelay — meškanie');
    expect(pairs).toEqual([
      { term: 'gate', definition: 'brána' },
      { term: 'layover', definition: 'prestup' },
      { term: 'delay', definition: 'meškanie' },
    ]);
  });

  it('does not split on a hyphen without spaces', () => {
    expect(parsePastedList('check-in desk - odbavovacia prepážka').pairs).toEqual([
      { term: 'check-in desk', definition: 'odbavovacia prepážka' },
    ]);
  });

  it('prefers the dash over a later comma', () => {
    expect(parsePastedList('departure - odchod, odlet').pairs).toEqual([{ term: 'departure', definition: 'odchod, odlet' }]);
  });

  it('falls back to a colon, then the first comma', () => {
    expect(parsePastedList('gate: brána\ncustoms, colnica, clo').pairs).toEqual([
      { term: 'gate', definition: 'brána' },
      { term: 'customs', definition: 'colnica, clo' },
    ]);
  });

  it('skips blank lines and reports bad lines with 1-based numbers', () => {
    const result = parsePastedList('gate - brána\r\n\r\nnope\nc -\ngate:');
    expect(result.pairs).toHaveLength(1);
    expect(result.errors).toEqual([
      { line: 3, text: 'nope', reason: 'no-separator' },
      { line: 4, text: 'c -', reason: 'no-separator' },
      { line: 5, text: 'gate:', reason: 'missing-part' },
    ]);
  });
});
