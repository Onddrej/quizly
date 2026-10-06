# Quizly

A simple, free Quizlet-style app for learning vocabulary: word sets, flashcards, pronunciation and a learn mode.

Runs in the browser and installs to the Android home screen as a PWA.

Live: https://onddrej.github.io/quizly/

Sets hold cards with a term, a translation and an optional definition and example sentences. Flashcards, Learn mode and pronunciation (the device's text-to-speech voices) work offline, and your data stays on the device.

## Commands

- `npm run dev` starts the dev server at http://localhost:5173/quizly/
- `npm test` runs the unit and component tests (Vitest)
- `npm run build` type checks and builds to `dist/`
- `npm run preview` serves the build at http://localhost:4173/quizly/ (the service worker only runs here, not in `npm run dev`)
- `npm run icons` regenerates the PWA icons from `public/logo.svg`

## Deploy

Deployed to GitHub Pages by the GitHub Actions workflow in `.github/workflows/deploy.yml`, which runs the tests and the build on every push to `main`. In the repository settings, Pages must use the source "GitHub Actions".

## Docs

- [CLAUDE.md](CLAUDE.md): project notes and conventions
- [PRODUCT.md](PRODUCT.md): product context
- [DESIGN.md](DESIGN.md): design system
- [Spec](docs/superpowers/specs/2026-10-01-quizly-v1-design.md) (Slovak)
- [Implementation plan](docs/superpowers/plans/2026-10-01-quizly-v1.md)
