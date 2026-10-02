import type { CardDraft } from '../../db/sets';

export interface EditorRow {
  key: string;
  id?: string;
  term: string;
  definition: string;
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

export function validateDraft(title: string, rows: readonly EditorRow[]): ValidationResult {
  const errors: EditorErrors = {};
  if (!title.trim()) errors.title = 'Add a title';

  const filled = rows.filter((r) => r.term.trim() || r.definition.trim());
  const rowErrors: NonNullable<EditorErrors['rows']> = {};
  for (const r of filled) {
    if (!r.term.trim()) rowErrors[r.key] = { term: 'Add a term' };
    else if (!r.definition.trim()) rowErrors[r.key] = { definition: 'Add a definition' };
  }
  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;
  if (filled.length === 0) errors.cards = 'Add at least one card';

  return {
    ok: !errors.title && !errors.rows && !errors.cards,
    errors,
    cards: filled.map((r) => ({ id: r.id, term: r.term, definition: r.definition })),
  };
}
