# Quizly

Personal Quizlet-style vocabulary PWA (sets, flashcards, pronunciation, Learn mode). Works offline, data stays on the device.

- Product context: PRODUCT.md
- Spec (Slovak): docs/superpowers/specs/2026-10-01-quizly-v1-design.md
- Implementation plan: docs/superpowers/plans/2026-10-01-quizly-v1.md
- Approved design: docs/design/screens-v1.html
- Design system (tokens, components): DESIGN.md
- Card-details amendment (translation, definition, examples): docs/superpowers/plans/2026-10-02-card-details-amendment.md

## Commands
- `npm run dev` – dev server at http://localhost:5173/quizly/
- `npm test` – Vitest unit and component tests
- `npm run test:watch` – Vitest in watch mode; `npx vitest run <path>` runs a single file or folder
- `npm run typecheck`
- `npm run build` – type check + production build to dist/
- `npm run preview` – serve dist/ at http://localhost:4173/quizly/
- `npm run icons` – regenerate the PWA icons and favicon.ico in public/ from public/logo.svg
- The service worker exists only in `npm run build` + `npm run preview`, not in `npm run dev`.

## Git
- Repo: github.com/Onddrej/quizly, personal account Onddrej. Local git identity is already set.
- The machine's active gh account is a work account, so push with:
  `GH_TOKEN=$(gh auth token --user Onddrej) git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`
- Conventional Commits (see global CLAUDE.md).

## Conventions
- UI text in English; Slovak appears only in user data and sample data.
- Colors only through tokens in src/styles/tokens.css; no literal colors in components.
- Pure logic (everything in src/lib except the React hook useSpeech.ts, plus pasteParser, editorValidation, answerCheck, the learn engine, flashcardSession and the parseBackup function, which only shares src/db/backup.ts with code that uses `db`) uses no React or Dexie and is written test-first.
- Outside tests, only src/db/* touches the Dexie `db` instance (components call src/db's repository functions and read through `useLiveQuery` or `useSetData`), and only src/lib/speech.ts touches `speechSynthesis` (hooks go through its helpers).
- Data field `definition` is the card's translation (UI label Translation); optional `meaning` (UI: Definition) and `examples` (UI: Examples).
- The impeccable plugin is enabled for this project; its design hook checks UI edits.
