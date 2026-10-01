# Quizly

Personal Quizlet-style vocabulary PWA (sets, flashcards, pronunciation, Learn mode). Works offline, data stays on the device.

- Product context: PRODUCT.md
- Spec (Slovak): docs/superpowers/specs/2026-10-01-quizly-v1-design.md
- Implementation plan: docs/superpowers/plans/2026-10-01-quizly-v1.md
- Approved design: docs/design/screens-v1.html

## Commands
- `npm run dev` – dev server at http://localhost:5173/quizly/
- `npm test` – Vitest unit and component tests
- `npm run test:watch` – Vitest in watch mode; `npx vitest run <path>` runs a single file or folder
- `npm run typecheck`
- `npm run build` – type check + production build to dist/
- `npm run preview` – serve dist/ at http://localhost:4173/quizly/

## Git
- Repo: github.com/Onddrej/quizly, personal account Onddrej. Local git identity is already set.
- The machine's active gh account is a work account, so push with:
  `GH_TOKEN=$(gh auth token --user Onddrej) git -c credential.helper= -c "credential.helper=!gh auth git-credential" push`
- Conventional Commits (see global CLAUDE.md).

## Conventions
- UI text in English; Slovak appears only in user data and sample data.
- Colors only through tokens in src/styles/tokens.css; no literal colors in components.
- Pure logic (everything in src/lib except the React hook useSpeech.ts, plus pasteParser, editorValidation, answerCheck, the learn engine, flashcardSession and the parseBackup function) has no React or Dexie imports and is written test-first.
- Only src/db/* touches the Dexie `db` instance; components call its repository functions and read through `useLiveQuery`. Only src/lib/speech.ts touches `speechSynthesis`; hooks go through its helpers.
- The impeccable plugin is enabled for this project; its design hook checks UI edits.
