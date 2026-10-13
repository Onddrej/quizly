/** Small words and phrasal-verb particles are not highlighted, so a marked phrase still reads naturally. */
const KEEP = new Set(['the', 'and', 'for', 'with', 'out', 'off', 'one', 'sth', 'sb', 'not', 'but', 'its', 'are', 'was']);

/** The words of a term worth highlighting: no part-of-speech tags, no leading "to", no placeholders. */
function termWords(term: string): string[] {
  const cleaned = term
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,\s*(noun|verb|adjective|adverb)\b/g, ' ')
    .replace(/^\s*to\s+/, ' ');
  const words = cleaned.match(/\p{L}+/gu) ?? [];
  return words.filter((w) => w.length >= 3 && !KEEP.has(w));
}

/** The word itself plus the regular endings an example sentence is likely to use. Irregular forms are not known. */
function forms(word: string): string[] {
  const out = new Set([word, `${word}s`, `${word}es`, `${word}ed`, `${word}d`, `${word}ing`, `${word}ly`]);
  const last = word[word.length - 1];
  if (last === 'e') out.add(`${word.slice(0, -1)}ing`);
  if (last === 'y') {
    out.add(`${word.slice(0, -1)}ies`);
    out.add(`${word.slice(0, -1)}ied`);
  }
  out.add(`${word}${last}ed`);
  out.add(`${word}${last}ing`);
  return [...out];
}

export interface TextPart {
  text: string;
  /** True for the part that is the term (or one of its regular forms). */
  match: boolean;
}

/**
 * Cuts `text` into parts so the term and its regular inflections can be highlighted in a definition or an example
 * sentence. Best effort: irregular forms such as "came" are not matched. The parts always add up to the original text.
 */
export function splitByTerm(text: string, term: string): TextPart[] {
  if (text === '') return [];
  const words = termWords(term);
  if (words.length === 0) return [{ text, match: false }];
  const alternatives = [...new Set(words.flatMap(forms))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(?<!\\p{L})(${alternatives.join('|')})(?!\\p{L})`, 'giu');
  // split with one capture group alternates: text, match, text, match, ..., text
  return text
    .split(pattern)
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}
