export interface ParsedPair {
  term: string;
  definition: string;
}

export interface ParseError {
  line: number;
  text: string;
  reason: 'no-separator' | 'missing-part';
}

export interface ParseResult {
  pairs: ParsedPair[];
  errors: ParseError[];
}

// A dash separates only with whitespace on both sides ("check-in" stays whole). \s also covers the
// non-breaking spaces that web, PDF and Word copies produce.
const SPACED_DASH = /\s[-–—]\s/;

function splitLine(line: string): [string, string] | null {
  const tab = line.indexOf('\t');
  if (tab !== -1) return [line.slice(0, tab), line.slice(tab + 1)];
  const dash = SPACED_DASH.exec(line);
  if (dash) return [line.slice(0, dash.index), line.slice(dash.index + dash[0].length)];
  const colon = line.indexOf(':');
  if (colon !== -1) return [line.slice(0, colon), line.slice(colon + 1)];
  const comma = line.indexOf(',');
  if (comma !== -1) return [line.slice(0, comma), line.slice(comma + 1)];
  return null;
}

/**
 * Parses pasted text into term/definition pairs. The Set editor relies on this contract:
 * - one card per non-blank line; a line without a separator, or with an empty term or definition,
 *   is reported in `errors` instead of becoming a card;
 * - the separator is the first of these found in the line: a tab, a dash (hyphen, en dash or em dash)
 *   with whitespace on both sides, a colon, a comma; the line is split at its first occurrence;
 * - the term and the definition are both trimmed;
 * - blank lines are skipped but still counted, so `ParseError.line` is the 1-based line number in the
 *   pasted text.
 */
export function parsePastedList(text: string): ParseResult {
  const pairs: ParsedPair[] = [];
  const errors: ParseError[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const parts = splitLine(line);
    if (!parts) {
      errors.push({ line: index + 1, text: line, reason: 'no-separator' });
      return;
    }
    const term = parts[0].trim();
    const definition = parts[1].trim();
    if (!term || !definition) {
      errors.push({ line: index + 1, text: line, reason: 'missing-part' });
      return;
    }
    pairs.push({ term, definition });
  });
  return { pairs, errors };
}
