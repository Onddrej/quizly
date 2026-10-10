export const BLANK = '_____';

/** Small words and phrasal-verb particles stay visible, so a masked phrase still reads naturally. */
const KEEP = new Set(['the', 'and', 'for', 'with', 'out', 'off', 'one', 'sth', 'sb', 'not', 'but', 'its', 'are', 'was']);

/** The words of a term that give the answer away: no part-of-speech tags, no leading "to", no placeholders. */
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

/**
 * Replaces the term (and its regular inflections) in `text` with a blank, so an example sentence or a definition can be
 * shown as a hint without giving the answer away. Best effort: irregular forms such as "came" are left as they are.
 */
export function maskTerm(text: string, term: string): string {
  const words = termWords(term);
  if (words.length === 0) return text;
  const alternatives = [...new Set(words.flatMap(forms))].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(?<!\\p{L})(?:${alternatives.join('|')})(?!\\p{L})`, 'giu');
  return text.replace(pattern, BLANK);
}
