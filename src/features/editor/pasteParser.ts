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

const SPACED_DASH = / [-–—] /;

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
