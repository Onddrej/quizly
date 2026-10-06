---
name: Quizly
description: A calm vocabulary study app in the Quizlet idiom, cool grey-blue or deep navy, one blue for actions, Figtree throughout.
colors:
  bg: "#F6F7FB"
  surface: "#FFFFFF"
  surface-2: "#EDEFF4"
  ink: "#282E3E"
  ink-2: "#586380"
  line: "#D9DDE8"
  accent: "#4255FF"
  accent-press: "#3443E6"
  accent-ink: "#3446F0"
  accent-soft: "#E7EAFF"
  on-accent: "#FFFFFF"
  good: "#0F7A56"
  good-fill: "#18AE79"
  good-soft: "#E1F5EC"
  bad: "#C43626"
  bad-fill: "#FF725B"
  bad-soft: "#FDEBE7"
  learning: "#B05200"
  learning-fill: "#FF983A"
  learning-soft: "#FFF0E0"
  star: "#F5B800"
  scrim: "rgba(10, 9, 45, .4)"
  bg-dark: "#0A092D"
  surface-dark: "#2E3856"
  surface-2-dark: "#1B1F46"
  ink-dark: "#F6F7FB"
  ink-2-dark: "#B8BFD6"
  line-dark: "#3D4772"
  accent-press-dark: "#3345EB"
  accent-ink-dark: "#A9B2FF"
  accent-soft-dark: "rgba(66, 85, 255, .26)"
  good-dark: "#4ED6A0"
  good-soft-dark: "rgba(24, 174, 121, .2)"
  bad-dark: "#FF9C8C"
  bad-soft-dark: "rgba(255, 114, 91, .18)"
  learning-dark: "#FFB066"
  learning-soft-dark: "rgba(255, 152, 58, .18)"
  star-dark: "#FFCD1F"
  scrim-dark: "rgba(0, 0, 0, .55)"
typography:
  wordmark:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  card-term:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  caption:
    fontFamily: "Figtree, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  ctl: "12px"
  card: "16px"
  sheet: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.accent-press}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.ctl}"
    padding: "0 12px"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.bad}"
    rounded: "{rounded.ctl}"
    padding: "0 20px"
    height: "48px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  answer-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "12px 16px"
    height: "56px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.ctl}"
    padding: "0 16px"
    height: "48px"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    padding: "8px 12px 10px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.ctl}"
    padding: "10px 16px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "8px 16px 20px"
---

# Design System: Quizly

## Overview

**Creative North Star: "The Study Desk"**

Quizly is Quizlet's study loop played straight: the app steps aside and leaves the word, its sound and the next step. The ground is a cool grey-blue (light) or deep navy (dark), cards are white or lifted navy with 16px corners, a single blue carries every action, and green, orange and red appear only to report learning state. Nothing asks the owner to relearn a layout; familiarity is the feature.

Density is comfortable and thumb-first: one column at most 560px wide, 48px minimum controls, bottom-anchored primary actions. Depth is soft and ambient, motion is short and functional, and type is one family at confident weights.

**Key Characteristics:**
- One blue for actions; green, orange and red only for learning state.
- Rounded-but-not-bubbly: 12px controls, 16px cards, 20px sheets and flashcards.
- Figtree only, heavy weights (600 to 800) for hierarchy, sentence case.
- Light and dark themes with identical roles; dark is a navy, not black.
- Lucide icons, stroke style, paired with text or an accessible name.

## Colors

A cool blue-grey neutral ramp with one saturated blue, and a three-colour state palette whose text variants are darkened (light) or lightened (dark) to hold 4.5:1 on their soft tints.

### Primary
- **Action Blue** (#4255FF, `accent`): filled primary buttons, the add button in the tab bar, switch on-state, thin progress fill, active pager dot. Same in both themes.
- **Pressed Blue** (#3443E6, `accent-press`): hover/pressed fill of primary actions (dark: #3345EB).
- **Link Ink Blue** (#3446F0, `accent-ink`): blue used as text and as the global focus ring and caret; wordmark, ghost buttons, links, active tab. Dark: #A9B2FF.
- **Blue Wash** (#E7EAFF, `accent-soft`): chips, ghost-button hover, text selection. Dark: translucent blue.

### Secondary (learning state)
- **Mastered Green** (text #0F7A56 `good`, fill #18AE79 `good-fill`, tint #E1F5EC `good-soft`): known/mastered counts, correct answers, completion.
- **Learning Orange** (text #B05200 `learning`, fill #FF983A `learning-fill`, tint #FFF0E0 `learning-soft`): still-learning counts and the learning segment of progress bars.
- **Miss Red** (text #C43626 `bad`, fill #FF725B `bad-fill`, tint #FDEBE7 `bad-soft`): wrong answers, field errors, destructive actions.
- Dark: `good` #4ED6A0, `bad` #FF9C8C, `learning` #FFB066; fills unchanged; tints are 18 to 20 percent alpha of the fill.

### Neutral
- **Mist** (#F6F7FB, `bg`): page ground. Dark: Deep Navy #0A092D.
- **Card White** (#FFFFFF, `surface`): cards, rows, sheets, bars, outline buttons. Dark: #2E3856.
- **Track Grey** (#EDEFF4, `surface-2`): progress tracks, segmented-control track. Dark: #1B1F46.
- **Ink** (#282E3E, `ink`): primary text; also the toast background. Dark: #F6F7FB.
- **Soft Ink** (#586380, `ink-2`): secondary text, meanings, examples, icons at rest. Dark: #B8BFD6.
- **Hairline** (#D9DDE8, `line`): 1px bar borders, 2px control borders, switch off-track, unstarted pager dots. Dark: #3D4772.
- **Star Gold** (#F5B800, `star`; dark #FFCD1F): starred terms and the focused underline of editor fields.
- **Scrim** (rgba(10,9,45,.4); dark rgba(0,0,0,.55)): behind sheets.

### Named Rules
**The Token-Only Rule.** Components never carry a literal colour; every colour is a variable from `src/styles/tokens.css`. The one literal fallback is the `#F6F7FB` meta theme-color default in ThemeSync.

**The State-Colour Rule.** Green, orange and red mean learning state or error and nothing else. Decoration uses blue or neutrals.

**The Text-Variant Rule.** Coloured text uses the text variants (`good`, `bad`, `learning`, `accent-ink`); the `-fill` variants are for bars, borders and dots, never for small text.

**The Two-Declaration Rule.** The dark set exists twice in tokens.css (inside `prefers-color-scheme: dark` for `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`). Change both together.

## Typography

**Display Font:** Figtree (self-hosted via @fontsource, 400 to 800 plus 400 italic) with system-ui, -apple-system, Segoe UI, Roboto, sans-serif.
**Body Font:** Figtree, same stack.

**Character:** Friendly geometric sans, used heavy for headings and numbers and plain for definitions. One family keeps the app quiet.

### Hierarchy
- **Headline** (800, 28px, 1.15, -0.01em): round-summary heading. Complete screen heading is 26px/800.
- **Card term** (700, 30px, 1.2): the Learn prompt word. Flashcard translation face is 28px/700/1.2, balanced wrap.
- **Wordmark** (800, 22px, -0.02em, Link Ink Blue): top-left of Home.
- **Title** (700 to 800, 17px, 1.3): resume card title, sheet and feedback titles, flashcard meaning (400).
- **Control** (600 to 700, 15 to 16px): buttons 15px/700, list row titles 16px/700, inputs 16px/600, answer options 16px/600.
- **Body** (400, 15px, 1.5): default text.
- **Caption** (13 to 14px, 400 to 700, tabular numerals): metadata, legends, counts. Tab labels 12px/600.
- **Field label** (700, 11px, 0.08em, uppercase, Soft Ink): the form-field label in the set editor only.

### Card back typography
Translation is bold, the optional definition (`meaning`) is regular in Soft Ink, and examples are italic Soft Ink. Absent parts are not rendered and spacing comes from `gap` only. Set-page list: 14px/600, 13px, 13px. Flashcard face: 28px/700, 17px, 15px, centered, scrolls inside the card when long.

### Named Rules
**The Weight-Not-Size Rule.** Hierarchy is carried by weight (400, 600, 700, 800) in a tight 12 to 17px band; sizes above 17px are reserved for the term being studied and screen headings.

**The Tabular Rule.** Counts, progress and timers use `font-variant-numeric: tabular-nums`.

## Layout

Mobile-first single column, content capped at 560px and centred (Page and Sheet both use 560px). Screen padding is 16px; page shells are TopBar (min 60px, three-column grid with centred title), content, and a bottom action area that respects `env(safe-area-inset-bottom)`. Spacing is a 2, 4, 6, 8, 10, 12, 14, 16, 18, 24px rhythm; 8, 10 and 12px gaps are the workhorses, lists use a 10px gap, cards pad 16 to 18px. Touch targets: 40px minimum (segmented options, icon buttons), 48px for buttons and search, 54 to 56px for answer inputs and options. Home order: wordmark, search, resume card, set list; bottom tab bar Home / + / Settings (three equal columns, the centre add button a 46px circle).

## Elevation & Depth

Hybrid: surfaces sit on a soft ambient shadow, and borders do the rest. Cards, active segmented option and toast use one shadow; sheets and the Learn feedback panel use an upward shadow. Rest-state flat elements (tab bar, bottom actions) use a 1px Hairline top border instead.

### Shadow Vocabulary
- **Card shadow** (`--shadow`: `0 1px 2px rgba(40,46,62,.06), 0 6px 18px rgba(40,46,62,.08)`; dark `0 1px 2px rgba(0,0,0,.3), 0 6px 18px rgba(0,0,0,.32)`): `.card`, list rows, toast, switch knob, active segment.
- **Sheet shadow** (`--sheet-shadow`: `0 -8px 24px -12px rgba(40,46,62,.3)`; dark `rgba(0,0,0,.6)`): bottom sheet and Learn feedback panel.

### Named Rules
**The Soft-Shadow Rule.** Shadows are blurred and low-contrast; hard offset shadows do not exist in this system.

## Shapes

Three corner sizes: controls 12px (`--r-ctl`), cards 16px (`--r-card`), sheets and the flashcard 20px (sheet top corners only). Pills (999px) for chips, counts, progress tracks, switch. Circles for the add button, state icons and the speaker button. Inputs on the editor are underline-only (2px bottom border, 0 radius); Home search and Learn answer input are 2px bordered boxes at 12px. Segmented options nest at 8px inside a 12px track. Progress legend swatches are 3px-radius squares.

## Components

Inventory (src/ui): Page, TopBar, TabBar, Button, IconButton, SpeakButton, Field, FieldArea, Segmented, Switch, StageBar, CardBack, EmptyState, Sheet, InlineConfirm, Toast. Feature pieces: Home resume card and set rows; Set page rows with pager dots; Flashcards flip card; Learn MultipleChoice, WrittenQuestion, Feedback, RoundSummary, SetComplete; Settings rows.

### Buttons
- **Shape:** 12px, 48px tall, 15px/700, 8px icon gap, optional full width (`block`).
- **Primary:** Action Blue fill, white text, hover Pressed Blue.
- **Outline:** surface fill, 2px Hairline border, hover border Soft Ink.
- **Ghost:** transparent, Link Ink Blue text, Blue Wash on hover.
- **Danger:** Miss Red tint fill, Miss Red text, 2px red-fill border; hover turns surface.
- **States:** hover only under `(hover: hover)`; `:active` nudges 1px down; disabled is 50 percent opacity. Transitions 100 to 150ms.

### Cards / Containers
- 16px corners, Card White, card shadow, 16 to 18px padding. Set rows and result rows reuse the same `.card` surface and scale to .99 on press.

### Chips and counts
- Chip: Blue Wash, Link Ink Blue, 12px/700, pill. Counts (flashcards): 30px pill, 14px/800, learning-soft/orange or good-soft/green.

### Inputs / Fields
- Editor field: transparent, 2px Ink underline, focus underline turns Star Gold, error underline Miss Red fill, 11px uppercase label, 13px/600 red error text.
- Search and Learn answer: 2px Hairline box, focus border Action Blue; correct/incorrect states use fill border plus soft tint. Caret and global focus ring (2px, 2px offset) use Link Ink Blue.
- Switch: 46x28 pill, Hairline off, Action Blue on, 22px white knob. Segmented: Track Grey track, active option lifted white with card shadow.

### Navigation
- TopBar: wordmark or centred 16px/700 title, icon buttons at the edges. TabBar: three columns, 12px/600 labels with Lucide icons, Soft Ink at rest, Link Ink Blue active, centre add button as Action Blue circle.

### Flashcard (signature)
A 20px card that flips in 3D (`rotateY` 180deg, 420ms, perspective 1400px); front shows the term, back uses the card-back typography; drag and tap gestures with `touch-action: pan-y`; a 4px thin progress bar and the two counts above it.

### Learn feedback and sheets
- Answer option: 56px, 2px Hairline border, correct = green fill border + good-soft, wrong = red fill border + bad-soft, others dim to 55 percent. A feedback panel slides up (240ms) with a 36px state icon, 17px/800 title and a full-width Continue.
- Sheet: scrim, 20px top corners, slides up 220ms. Toast: Ink pill above the tab bar, 14px/600.
- StageBar: 10px (8px small) pill track with mastered and learning segments and a legend of 10px swatches.

### Motion
Ease-out token `--ease-out` = `cubic-bezier(.2, .8, .2, 1)`; durations 100 to 150ms for colour and press, 180 to 250ms for movement, 420ms for the card flip. Reduced motion collapses every transition and animation to .01ms. Accepted note: `transition: width` on Set-page pager dots and StageBar segments.

## Do's and Don'ts

### Do:
- **Do** take every colour from a token in `src/styles/tokens.css` and set both theme blocks together.
- **Do** use Action Blue for the single primary action per view and keep it at the bottom within thumb reach.
- **Do** use `-fill` colours for bars and borders and text variants for coloured text.
- **Do** keep controls at 12px radius, cards at 16px, sheets and the flashcard at 20px.
- **Do** show absent card-back parts as nothing, never as empty placeholders.
- **Do** pair every icon (Lucide) with a visible label or an accessible name.

### Don't:
- **Don't** use green, orange or red for decoration; they mean learning state or error.
- **Don't** use hard offset shadows or heavy borders on cards; depth is the soft card shadow.
- **Don't** introduce a second accent colour or a new font family.
- **Don't** reinvent layouts the owner already knows from Quizlet (tab bar, resume card, flip card, option list).
- **Don't** rely on hover for any function; hover styling is gated to hover-capable pointers.

