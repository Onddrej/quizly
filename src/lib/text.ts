const EDGE_PUNCTUATION = /^[\s.,;:!?¿¡"'()[\]{}…-]+|[\s.,;:!?¿¡"'()[\]{}…-]+$/g;

/** Comparison form of an answer: lowercase, no diacritics, single spaces, no edge punctuation. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Alternative answers written in one field, e.g. "odchod, odlet" or "trip / journey". */
export function splitVariants(text: string): string[] {
  return text
    .split(/[,/;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
