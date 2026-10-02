export interface CardDetails {
  /** Optional definition in the term's language (UI label "Definition"). */
  meaning?: string;
  /** Optional example sentences, one per line, joined with `\n` (UI label "Examples"). */
  examples?: string;
}

/**
 * Splits example sentences into lines (spec 5.7): split on any line break (`\r\n`, `\r` or `\n`), trim each line and
 * drop the empty ones. `undefined` and blank input give an empty list.
 */
export function splitExamples(value?: string): string[] {
  return (value ?? '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Normalizes the optional card details (spec 5.7): `meaning` is trimmed; `examples` is split on line breaks, each line
 * trimmed, empty lines dropped and the rest re-joined with `\n`. A value that ends up empty is left out, so the returned
 * object never has an empty or `undefined`-valued property and is safe to spread into a card.
 */
export function normalizeCardDetails(input: CardDetails): CardDetails {
  const details: CardDetails = {};
  const meaning = input.meaning?.trim();
  if (meaning) details.meaning = meaning;
  const examples = splitExamples(input.examples).join('\n');
  if (examples) details.examples = examples;
  return details;
}
