# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, then confirmed by the user: a Progressive Web App built with React + TypeScript + Vite, installable to the Android home screen, working offline through a service worker. Data lives on the device in IndexedDB. Deployed to GitHub Pages (public repo `Onddrej/quizly`) through GitHub Actions. A native wrapper (TWA via PWABuilder, or Capacitor) stays possible later from the same code; it is not planned.

## Users

One primary user: the owner, a Slovak speaker learning English vocabulary. Studies mostly on an Android phone in short sessions (commuting, evenings), sometimes on a PC. Personal use; no other audiences confirmed.

## Product Purpose

A free replacement for Quizlet's core study loop without the paywall: word sets, flashcards, English pronunciation and a Learn mode. Success means the owner uses it instead of Quizlet for daily vocabulary study.

## Positioning

Quizlet's familiar study flow, including Learn mode, with no subscription, no ads, no account, and data that stays on the device and works offline.

## Operating Context

- Sets are created by typing terms or pasting a whole word list at once (one pair per line).
- Terms are English; definitions are usually Slovak.
- Pronunciation comes from the device's text-to-speech voices (Web Speech API), not recorded audio, so any added word can be spoken.
- Study happens one-handed on a phone, often in short bursts.

## Capabilities and Constraints

- v1 scope: sets (create, edit, delete, bulk paste), flashcards, pronunciation, Learn mode (multiple choice, then typing the English term, then typing the definition, in rounds until every term is mastered).
- Interface language: English.
- Pronunciation: English, with a US/UK voice preference.
- Answer checking in Learn mode tolerates case, diacritics and small typos.
- Data is stored only in the browser; export/import of a backup file protects against clearing browser data.
- No sync between devices and no user accounts in v1.
- Undecided: Test and Match modes, spaced repetition, sharing sets.

## Brand Commitments

- Name: Quizly.
- The interface should resemble Quizlet's, which the owner likes and explicitly asked to follow. Familiar Quizlet patterns (set page with mode tiles, flip cards, Learn mode rounds) are the reference; Quizlet's name and logo are not used.

## Evidence on Hand

No real content yet. Example word sets in designs are synthetic and must be labelled as examples.

## Product Principles

1. Studying starts in one or two taps from opening the app.
2. Pronunciation is available wherever an English term appears.
3. Familiar beats novel: follow the Quizlet patterns the owner already knows.
4. Works offline and fast; nothing depends on a server.
5. The owner's word sets are never lost silently.
