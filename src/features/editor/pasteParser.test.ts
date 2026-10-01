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

const pair = (term: string, definition: string) => ({ term, definition });

describe('parsePastedList: separator priority', () => {
  it('lets a tab win over a dash, colon or comma', () => {
    expect(parsePastedList('run, ran, run\tbežať').pairs).toEqual([pair('run, ran, run', 'bežať')]);
    expect(parsePastedList('ratio 3:1\tpomer').pairs).toEqual([pair('ratio 3:1', 'pomer')]);
    expect(parsePastedList('gate - exit\tbrána').pairs).toEqual([pair('gate - exit', 'brána')]);
  });

  it('lets a spaced dash win over a colon', () => {
    expect(parsePastedList('ratio 3:1 - pomer').pairs).toEqual([pair('ratio 3:1', 'pomer')]);
  });

  it('lets a colon win over a comma', () => {
    expect(parsePastedList('gate: brána, vstup').pairs).toEqual([pair('gate', 'brána, vstup')]);
  });
});

describe('parsePastedList: splitting rules', () => {
  it.each([
    ['tab', 'gate\tbrána\tvstup', 'gate'],
    ['spaced dash', 'gate - brána - východ', 'gate'],
    ['colon', 'gate: brána: vstup', 'gate'],
  ])('splits on the first %s', (_name, line, term) => {
    expect(parsePastedList(line).pairs[0]?.term).toBe(term);
  });

  it('only splits on a dash that has a space on both sides (prefix "pre-")', () => {
    expect(parsePastedList('pre- - pred').pairs).toEqual([pair('pre-', 'pred')]);
  });

  it.each(['gate   -   brána', 'gate : brána', '  gate \t brána  '])('trims term and definition: %j', (line) => {
    expect(parsePastedList(line).pairs).toEqual([pair('gate', 'brána')]);
  });
});

describe('parsePastedList: errors and real-world input', () => {
  it('skips whitespace-only lines and keeps line numbers aligned (CRLF, trailing newline)', () => {
    const result = parsePastedList('a - b\r\n \r\nbad\r\n\t\r\nc - d\r\nbad2\r\n');
    expect(result.pairs).toEqual([pair('a', 'b'), pair('c', 'd')]);
    expect(result.errors.map((e) => e.line)).toEqual([3, 6]);
  });

  it('reports the trimmed text of a bad line', () => {
    expect(parsePastedList('  nope  \n\tgate:  ').errors).toEqual([
      { line: 1, text: 'nope', reason: 'no-separator' },
      { line: 2, text: 'gate:', reason: 'missing-part' },
    ]);
  });

  it('reports an empty term as missing-part', () => {
    expect(parsePastedList(': brána').errors).toEqual([{ line: 1, text: ': brána', reason: 'missing-part' }]);
  });

  it('returns nothing for empty input', () => {
    expect(parsePastedList('')).toEqual({ pairs: [], errors: [] });
    expect(parsePastedList(' \n\t\n')).toEqual({ pairs: [], errors: [] });
  });

  it('handles a Quizlet export with a BOM, CRLF and a trailing newline', () => {
    expect(parsePastedList('\uFEFFluggage\tbatožina\r\ngate\tbrána\r\n')).toEqual({
      pairs: [pair('luggage', 'batožina'), pair('gate', 'brána')],
      errors: [],
    });
  });
});
