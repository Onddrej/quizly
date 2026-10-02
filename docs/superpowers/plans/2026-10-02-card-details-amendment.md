# Plan amendment A: optional card details (2026-10-02)

Source: spec section 5.7 (Slovak) in `docs/superpowers/specs/2026-10-01-quizly-v1-design.md`, requested by the owner after Task 13 of `2026-10-01-quizly-v1.md` was implemented.

**What changes.** A card's answer side has up to three parts: the translation (required, may list comma-separated alternatives), an optional definition in the term's language (English) and optional example sentences (one or two, one per line). Checking in Learn compares only the translation; typing any one comma-separated translation is enough (already how `checkAnswer` works).

**Vocabulary (keep it consistent in code, tests and UI):**

| Meaning | Data field | UI label |
|---|---|---|
| the English word | `term` | Term |
| main translation (required, comma-separated alternatives) | `definition` (unchanged name, no rename) | Translation |
| optional definition in English | `meaning` (new, optional string) | Definition |
| optional example sentences, one per line | `examples` (new, optional string) | Examples |

**Execution.** The original plan stays as is. This amendment adds two new tasks before Task 14 and a "Part B" to Tasks 14-17 (implemented as a second commit after the plan's own task, test first). Fields that are empty are never stored (the property is absent, never `undefined`-valued).

---

## Task 13b: card details in types, repositories and backup

**Files:** modify `src/db/types.ts`, `src/db/sets.ts`, `src/db/backup.ts`, `CLAUDE.md`; create `src/db/cardDetails.test.ts`.

- `Card` gets `meaning?: string` and `examples?: string` (doc comments: `definition` is the translation; `meaning` is the optional English definition; `examples` holds 1-2 sentences separated by `\n`).
- `CardDraft` (in `src/db/sets.ts`) gets `meaning?: string` and `examples?: string`.
- Normalization (one small exported pure helper in `src/db/sets.ts` or a tiny pure module `src/lib/cardDetails.ts`, your choice, with tests): `meaning` is trimmed; `examples` is split on newlines, each line trimmed, empty lines dropped, re-joined with `\n`; a value that ends up empty is omitted.
- `createSet`: stores the normalized extras on new cards (property absent when empty).
- `updateSet`: a kept card (draft with an `id` of this set) gets the draft's normalized values; when the draft's value is empty or absent the stored property is REMOVED (clearing works); progress, stars and answer times are kept as today. New cards get the extras when present. Never write `undefined`-valued properties.
- `parseBackup` (`toCard`): `meaning` and `examples`, when present (not `undefined`), must be strings, otherwise the file is invalid (`BackupError`); they are copied to the result only when present. Old backups without them stay valid; `version` stays 1. `createBackup` and `importBackup` need no logic change (verify with a round trip).
- `CLAUDE.md` Conventions: add one bullet: "Data field `definition` is the card's translation (UI label Translation); optional `meaning` (UI: Definition) and `examples` (UI: Examples)."
- Tests first (red, then green) in `src/db/cardDetails.test.ts`: normalization cases; `createSet` stores trimmed extras and omits empties; `updateSet` sets, changes and clears extras and keeps stage/star/answer time; a kept card without draft extras loses old extras; a card from another set id behaves as before; backup round trip keeps the extras (and the property is absent when empty); `parseBackup` rejects non-string `meaning`/`examples` and accepts old files; `listSetSummaries` unaffected. Existing tests must stay green.
- Commit: `feat(db): add optional meaning and examples to cards`.

## Task 13c: CardBack component for the answer side

**Files:** create `src/ui/CardBack.tsx`, `src/ui/CardBack.module.css`, `src/ui/CardBack.test.tsx`; modify `src/main.tsx` (one import).

- `import '@fontsource/figtree/400-italic.css';` in `src/main.tsx` (real italic, self-hosted, precached later by the PWA glob).
- `CardBack` props: `{ card: Pick<Card, 'definition' | 'meaning' | 'examples'>; lang?: string; variant?: 'row' | 'face' }` (default `row`). Renders a wrapper with: the translation paragraph (bold), the meaning paragraph when present (normal weight, `--ink-2`, `lang="en"`), and the examples as a list with one item per line when present (italic, `--ink-2`, `lang="en"`). Parts that are absent render nothing and leave no gap.
- `row` variant (Set page list): translation 15px / 600 / `--ink`, meaning 14px, examples 13px italic; left aligned.
- `face` variant (flashcard): centered text; translation 28px / 700, meaning 17px, examples 15px italic; the wrapper scrolls vertically (`overflow-y: auto`, `max-height: 100%`, min-height 0) so long content stays inside the card.
- Colors only through tokens; `overflow-wrap: anywhere` on text; text must stay readable in dark theme.
- Tests: absent parts render nothing; translation always shown; examples split into one element per line; `lang` is applied to the translation; both variants render the same content.
- Commit: `feat(ui): add card back block for translation, definition and examples`.

---

## Part B for Task 14 (set editor), after the plan's own Task 14

- `EditorRow` gets `meaning` and `examples` (strings, default empty); `validateDraft` treats a row as filled when any of the four fields has text, requires term and translation for filled rows (errors "Add a term" / "Add a translation"), and passes `meaning`/`examples` through into `CardDraft`.
- UI: rename the visible label "Definition" of the main field to "Translation" and its error to "Add a translation"; the paste hint becomes "One pair per line. Separate term and translation with a dash, tab or comma." (the label text the plan's test queries, `/One pair per line/`, still matches); parse-error copy unchanged.
- Under Term/Translation of each card add the collapsible panel from spec 5.7: a ghost-style toggle button "Add definition and examples" (icon chevron, `aria-expanded`; label "Edit definition and examples" when the panel is closed but has text) that reveals `Field` "Definition" and a labelled textarea "Examples" with the hint "One or two sentences, one per line." The panel is closed for new cards, open automatically for existing cards that have either field, and closing it hides the fields but keeps the text. Styling: reuse the existing `Field` look (underlined single-line field; the textarea has the same underline style and label below), spacing consistent with the row; no new colors.
- Editing an existing set loads `meaning` and `examples` into the rows; saving passes them to `updateSet` (so clearing works).
- Adapt the plan's tests for the renamed label/error and add tests: toggle opens the panel; saved card has the extras; empty extras are not stored; existing card with extras opens expanded; clearing a field removes it; a row with only a Definition shows the term and translation errors.

## Part B for Task 15 (set page)

- In the terms list, render `CardBack` (variant `row`, `lang` = the set's `definitionLang`) below the term instead of the plain definition line (term stays the bold headline). The implemented `row` variant is translation 14px/600 `--ink`, meaning 13px `--ink-2`, examples 13px italic `--ink-2`; to keep the term the visual anchor make the term (`.t`) 16px/700 (it was body size). Do not clamp the row height. Test: a card with meaning and examples shows them; a card without shows only the translation.

## Part B for Task 16 (flashcards)

- Wherever the definition side of a card is shown (front when "Start with definition" is on, back otherwise) render `CardBack` (variant `face`) instead of the single `.word` paragraph; the term side is unchanged. Keep the language chip. Place `CardBack` as the middle child of the existing face grid (`auto 1fr auto`, as in the design); it centers itself with `margin-block: auto` and scrolls inside the card when tall, so do not wrap it in a flex column. Note for acceptance on the phone: touch scrolling inside the rotated face is unverified. Make sure the PWA precache glob keeps `woff2` (the italic font files). Tests: the back/front shows translation, meaning and examples; term side unchanged.

## Part B for Task 17 (Learn page), together with the guard already approved

- UI copy: the written-question label "Definition" becomes "Translation"; "Choose the matching definition" becomes "Choose the matching translation"; "Type the definition in Slovak" (any language name) becomes "Type the translation in Slovak"; in the feedback copy "definition" becomes "translation" where it names the card's translation (e.g. "Next time you'll type the Slovak translation."). Multiple-choice options and the round summary keep showing `definition` (the translation) only. Learn never shows or checks `meaning`/`examples`. Adapt the plan's tests to the new strings.
- Guard (already approved earlier): if the set has fewer than 2 cards the page navigates to the set page (`replace`) instead of starting a round (+ test).

## Reviewers

Spec reviewers verify each task against its plan text and, for Part B items, against this document. Quality reviewers also check that the new UI fits the existing pages visually (tokens, spacing, Figtree weights, dark theme) and that nothing reads or shows `meaning`/`examples` in Learn checks.
