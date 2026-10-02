import type { CardDraft } from '../../db/sets';

export interface EditorRow {
  key: string;
  id?: string;
  term: string;
  /** The card's translation (UI label "Translation"). */
  definition: string;
  /** Optional definition in English (UI label "Definition"); empty string when not filled. */
  meaning: string;
  /** Optional example sentences, one per line (UI label "Examples"); empty string when not filled. */
  examples: string;
}

export interface EditorErrors {
  title?: string;
  cards?: string;
  rows?: Record<string, { term?: string; definition?: string }>;
}

export interface ValidationResult {
  ok: boolean;
  errors: EditorErrors;
  cards: CardDraft[];
}

/** A row counts as filled (and is saved) when any of its four fields has non-blank text; all-blank rows are ignored (spec 4.2). */
export function isFilledRow(row: EditorRow): boolean {
  return Boolean(row.term.trim() || row.definition.trim() || row.meaning.trim() || row.examples.trim());
}

export function validateDraft(title: string, rows: readonly EditorRow[]): ValidationResult {
  const errors: EditorErrors = {};
  if (!title.trim()) errors.title = 'Add a title';

  const filled = rows.filter(isFilledRow);
  const rowErrors: NonNullable<EditorErrors['rows']> = {};
  for (const r of filled) {
    const missing: { term?: string; definition?: string } = {};
    if (!r.term.trim()) missing.term = 'Add a term';
    if (!r.definition.trim()) missing.definition = 'Add a translation';
    if (missing.term || missing.definition) rowErrors[r.key] = missing;
  }
  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;
  if (filled.length === 0) errors.cards = 'Add at least one card';

  return {
    ok: !errors.title && !errors.rows && !errors.cards,
    errors,
    // meaning and examples go through as typed; createSet/updateSet normalize them and omit empty values
    cards: filled.map((r) => ({ id: r.id, term: r.term, definition: r.definition, meaning: r.meaning, examples: r.examples })),
  };
}
