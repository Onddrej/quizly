# Quizly v1 – špecifikácia

- **Dátum:** 2026-10-01
- **Stav:** návrh na schválenie
- **Revízia 2026-10-02:** karta má povinný preklad a voliteľnú definíciu a príkladové vety (pozri 5.7)
- **Produktový kontext:** [PRODUCT.md](../../../PRODUCT.md)
- **Schválený dizajn:** [docs/design/screens-v1.html](../../design/screens-v1.html) (publikované aj ako [artifact](https://claude.ai/artifact/QNCG6bYrZLEGL1y9r4FBgq))

## 1. Cieľ

Osobná náhrada Quizletu na učenie anglických slovíčok: sety, kartičky, výslovnosť a Learn mód, zadarmo, bez účtu, offline. Hlavné zariadenie je Android telefón (appka nainštalovaná na plochu), vedľajšie PC.

v1 je hotová, keď si vlastník na telefóne nainštaluje Quizly z GitHub Pages, vytvorí set vložením zoznamu, prejde ho kartičkami aj Learn módom až do zvládnutia všetkých slovíčok a všetko funguje aj v režime lietadla.

## 2. Rozsah

**Vo v1**

- Sety: vytvorenie, úprava, zmazanie, hromadné vloženie zoznamu.
- Karta s povinným prekladom a voliteľnou definíciou a príkladovými vetami (5.7).
- Kartičky (Flashcards) so zaraďovaním „ešte sa učím" / „viem".
- Learn mód: výber z možností → písanie anglického slovíčka → písanie slovenského prekladu, po kolách, kým nie je všetko zvládnuté.
- Výslovnosť anglických slovíčok cez hlasy zariadenia (US / UK).
- Hviezdičky pri slovíčkach a režim kartičiek „len označené".
- Nastavenia: prízvuk, téma, záloha (export/import), inštalácia appky.
- PWA: inštalovateľná, plne offline, automatické aktualizácie.

**Mimo v1:** Test a Match módy, spaced repetition, synchronizácia a účty, zdieľanie setov, obrázky na kartičkách, čítanie definícií nahlas, preusporiadanie kartičiek ťahaním, Learn len z označených, viacjazyčné rozhranie.

## 3. Technológie

| Oblasť | Voľba | Prečo |
|---|---|---|
| Build | Vite + React + TypeScript | rýchly vývoj, typová kontrola |
| Routing | `react-router` s `HashRouter` | GitHub Pages nevie presmerovať neznáme cesty na `index.html`; hash URL funguje bez triku s 404 stránkou |
| Dáta | IndexedDB cez Dexie (+ `dexie-react-hooks`) | reaktívne dotazy (`useLiveQuery`), jednoduché migrácie schémy |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`, `registerType: 'autoUpdate'`) | precache celej appky, manifest, aktualizácie |
| Ikony appky | `@vite-pwa/assets-generator` zo zdrojového SVG | PNG ikony 192/512 + maskable bez ručného exportu |
| Štýly | CSS custom properties (tokeny zo schváleného dizajnu) + CSS Modules | žiadny runtime, tokeny priamo z návrhu |
| Ikony v UI | `lucide-react`, stroke 2 | rovnaká sada ako v návrhu |
| Písmo | Figtree cez `@fontsource/figtree` (self-hosted) | funguje offline, bez Google Fonts za behu |
| Testy | Vitest + React Testing Library + `fake-indexeddb` | unit testy čistej logiky, komponentové testy tokov |
| Nasadenie | GitHub Actions → GitHub Pages | zadarmo, HTTPS (podmienka PWA) |

Adresa appky: `https://onddrej.github.io/quizly/` (Vite `base: '/quizly/'`).

## 4. Obrazovky a routy

| Route | Obrazovka | V návrhu |
|---|---|---|
| `#/` | Home | 1 |
| `#/create` | Vytvorenie setu | 2 |
| `#/sets/:setId` | Set | 3 |
| `#/sets/:setId/edit` | Úprava setu (rovnaký editor ako vytvorenie) | 2 |
| `#/sets/:setId/flashcards` | Kartičky | 4 |
| `#/sets/:setId/learn` | Learn (otázky, spätná väzba, koniec kola, dokončenie) | 5–7 |
| `#/settings` | Nastavenia | nové, v štýle návrhu |

Systémové tlačidlo Späť na Androide funguje cez históriu prehliadača. Neexistujúci set alebo route → stránka „This set doesn't exist" s tlačidlom na Home.

### 4.1 Home

- **Prázdny stav:** nadpis „Create your first set", veta „Paste a word list and start learning in a minute." a tlačidlo „Create set".
- **Jump back in:** set s najnovším `lastStudiedAt`, ukazovateľ pokroku (mastered / learning / not studied), číslo kola a tlačidlo „Continue learning" → Learn. Zobrazí sa, len ak sa už niektorý set študoval.
- **Your sets:** všetky sety podľa `lastStudiedAt`, inak `updatedAt`, zostupne. Každý riadok ukazuje názov, počet slovíčok a počet zvládnutých.
- **Hľadanie:** ikona lupy otvorí pole, ktoré filtruje sety podľa názvu.
- **Spodná lišta:** Home, Create (+), Settings.

### 4.2 Editor setu (vytvorenie / úprava)

- **Polia:** Title (povinné) a jazyk prekladu (predvolene Slovak; zobrazí sa na zadnej strane kartičky). Jazyk pojmov je vždy angličtina a prízvuk výslovnosti sa riadi nastavením.
- **Paste a list:** textové pole, pod ním živý počet „Add N cards" a zoznam riadkov, ktoré sa nedajú rozdeliť (napr. „Line 4: no separator found"). Pravidlá v 5.3.
- **Kartičky:** číslované, s poľami Term / Translation, voliteľným panelom „Definition and examples" (5.7), tlačidlom zmazania a na konci „Add card". Nový set začína dvoma prázdnymi kartičkami.
- **Save:**
  - Prázdne kartičky (všetky štyri polia prázdne) sa ignorujú.
  - Kartička s vyplneným poľom, ale bez pojmu alebo bez prekladu, zobrazí chybu pri chýbajúcom poli („Add a translation" / „Add a term").
  - Set potrebuje názov a aspoň 1 kartičku.
  - Po uložení presmeruje na stránku setu.
- **Úprava existujúcich kartičiek:** zmena textu zachová pokrok, zmazanie kartičku odstráni aj s pokrokom.
- **Neuložené zmeny:** pri odchode sa zobrazí vložený panel „Discard changes?" s tlačidlami Discard / Keep editing, nie `confirm()`.

### 4.3 Set

- **Obsah stránky:** náhľad kartičiek (horizontálne posúvanie s bodkami), názov, „N terms · English → Slovak", módy Flashcards a Learn, pokrok (3-farebný pruh + legenda) a zoznam slovíčok s reproduktorom a hviezdičkou; pod pojmom blok preklad / definícia / príklady (5.7).
- **Menu (⋯):**
  - „Edit set".
  - „Reset progress" s vloženým potvrdením.
  - „Delete set" s vloženým potvrdením („Delete Travel & airport? This removes 24 cards and your progress.").
- **Learn pri sete s 1 kartičkou:** tlačidlo je neaktívne s textom „Add at least 2 cards to use Learn".

### 4.4 Nastavenia

- **Pronunciation:**
  - Voľba US / UK a tlačidlo „Test voice".
  - Ak zariadenie nemá anglický hlas: „No English voice found on this device. Install one in Android Settings → Text-to-speech."
- **Theme:** System / Light / Dark.
- **Backup:**
  - „Export backup" stiahne `quizly-backup-YYYY-MM-DD.json`.
  - „Import backup" otvorí výber súboru. Zobrazí sa náhľad („3 sets, 96 cards") a potvrdenie. Sety s rovnakým ID sa prepíšu, ostatné sa pridajú.
- **Install app:** zobrazí sa, keď prehliadač ponúkne udalosť `beforeinstallprompt`. Po inštalácii zmizne.
- **About:** verzia appky a odkaz na GitHub.

## 5. Správanie

### 5.1 Stav slovíčka

Každá kartička má `stage`. Slovíčko prejde tromi typmi otázok: výber z možností → písanie anglického pojmu → písanie definície (naopak).

| stage | Význam | Zobrazenie | Ďalšia otázka v Learn |
|---|---|---|---|
| 0 | ešte nevidené | not studied | výber z možností |
| 1 | videné, zatiaľ chyba vo výbere | learning | výber z možností |
| 2 | správne vo výbere | learning | písanie: definícia → anglický pojem |
| 3 | správne napísaný anglický pojem | learning | písanie naopak: anglický pojem → definícia |
| 4 | správne napísaná aj definícia | mastered | – |

Prechody:
- Správna odpoveď (pri písaní aj s preklepom alebo cez „I was right") posunie slovíčko o jeden krok: 0/1 → 2 → 3 → 4.
- Chyba alebo „Don't know?" vráti slovíčko o jeden typ otázky späť:
  - chyba vo výbere → 1 (zostáva výber),
  - chyba pri písaní anglického pojmu → 1 (späť na výber),
  - chyba pri písaní definície → 2 (späť na písanie anglického pojmu).

Kartičky (Flashcards) `stage` nemenia.

### 5.2 Learn mód

- **Kolo** má 7 slovíčok (`ROUND_SIZE = 7`), pri menšom počte nezvládnutých slovíčok menej.
- **Výber do kola:**
  1. Najprv rozpracované slovíčka (stage 1, 2 a 3), od najdlhšie nevidených (`lastAnsweredAt`).
  2. Potom nové (stage 0) v poradí setu.
- **Poradie v kole:** slovíčka sa pýtajú v zamiešanom poradí.
- **Chyby v kole:** slovíčko s chybou sa zaradí na koniec kola a spýta sa znova, najviac 2-krát za kolo.
- **Výber z možností:**
  - Zobrazí sa pojem (s reproduktorom) a 4 preklady: správny + 3 náhodné iné preklady z toho istého setu.
  - Duplicitné texty sa vylúčia.
  - Set s 2–3 kartičkami má 2–3 možnosti.
- **Písanie anglického pojmu** (stage 2): zobrazí sa preklad s nadpisom „Translation" a výzva „Type the English term". Rozloženie podľa obrazovky 6 v návrhu.
- **Písanie naopak** (stage 3): zobrazí sa anglický pojem s nadpisom „Term" a reproduktorom a výzva „Type the translation in Slovak" (jazyk podľa `definitionLang` setu). Rozloženie rovnaké ako obrazovka 6, len s vymeneným obsahom.
  - Ak preklad obsahuje viac variantov oddelených čiarkou (napr. „odchod, odlet"), stačí napísať ktorýkoľvek z nich.
- **Vyhodnotenie oboch typov písania** podľa 5.4.
- **Spätná väzba:** panel zdola s výsledkom, pri chybe so správnou odpoveďou, tlačidlom „Continue" a reproduktorom pri anglickom slove.
  - Pri chybe v písaní (oboch smeroch) je tlačidlo „I was right", ktoré odpoveď uzná ako správnu (pre synonymá).
  - Pri chybe v písaní prekladu sa zobrazí celý preklad so všetkými variantmi a poznámka „Any one of these is enough."
  - Enter = Continue.
- **Koniec kola:**
  - „Round N done".
  - „X of Y correct" (správne na prvý pokus).
  - „Z terms are now mastered".
  - Aktualizovaný pruh pokroku a zoznam slovíčok z kola so stavom Mastered / Again.
  - Tlačidlá „Continue to round N+1" a „Back to set".
- **Dokončenie setu:** keď majú všetky kartičky stage 4, zobrazí sa „You've mastered all 24 terms" s tlačidlami „Study again" (reset `stage` na 0) a „Back to set".
- **Pokračovanie neskôr:** stav je v DB (`stage` na kartičkách, `learnRound` na sete). Zatvorenie appky uprostred kola nič nestratí; po návrate sa zostaví nové kolo z aktuálnych stavov.
- **Číslovanie kôl:** `learnRound` sa zvýši o 1 po dokončení kola. „Study again" aj „Reset progress" ho vrátia na 1.
- **Rozloženie počas otázky:** hore „Round N", pod tým pruh pokroku s počtom zvládnutých a celkovým počtom.

### 5.3 Vloženie zoznamu (parser)

- **Riadky:** každý neprázdny riadok je jedna kartička. Oddeľovač sa hľadá v tomto poradí a rozdeľuje sa na prvom výskyte:
  1. tabulátor,
  2. pomlčka s medzerami (` - `, ` – `, ` — `),
  3. `:`,
  4. prvá čiarka (`,`).
- **Pomlčky bez medzier sa nedelia** (`check-in desk` ostane celé).
- **Chyby riadkov:** riadok bez oddeľovača, s prázdnym pojmom alebo s prázdnou definíciou je chyba riadku. Zobrazí sa číslo riadku a do kartičiek sa nepridá.
- **Úprava textu:** okolité medzery sa orežú.
- **Pridanie:** „Add N cards" pridá kartičky na koniec zoznamu v editore a vyprázdni pole.

### 5.4 Vyhodnotenie napísanej odpovede

Rovnaké pravidlá platia pre oba smery. Očakávaná odpoveď je anglický pojem (stage 2) alebo preklad (stage 3). Porovnáva sa vždy len preklad (pole `definition`); voliteľná definícia a príkladové vety sa pri kontrole nikdy nepoužívajú (5.7).

1. **Normalizácia** (odpoveď aj očakávaný text):
   - malé písmená, odstránenie diakritiky (NFD), zlúčenie medzier, orezanie,
   - typografické apostrofy → `'`,
   - odstránenie interpunkcie na začiatku a konci.
   - Diakritika sa teda neráta ako chyba ani v slovenčine („batozina" = „batožina").
2. **Prijateľné varianty:**
   - celý očakávaný text,
   - každá časť po rozdelení cez `,`, `/` alebo `;` (napr. pri „odchod, odlet" stačí „odchod" aj „odlet"),
   - len pri anglickom pojme: pri každom variante aj verzia bez úvodného `to `, `a `, `an `, `the `.
3. **Výsledok:**
   - **presná zhoda** s variantom → správne,
   - **Levenshteinova vzdialenosť** ≤ 1 pre dĺžku 4–7 znakov alebo ≤ 2 pre 8+ znakov → správne s poznámkou „Correct, small typo" a správnym pravopisom,
   - inak → nesprávne.
4. **Krátke slová** (1–3 znaky) musia sedieť presne.

### 5.5 Kartičky (Flashcards)

- **Prehrávanie:**
  - Poradie ako v sete, prepínač Shuffle.
  - Ťuknutie / Space otočí kartičku.
  - Tlačidlá ✕ / ✓, swipe doľava / doprava a klávesy ← / → zaradia kartičku.
  - Undo vráti poslednú.
- **Zobrazenie:** hore „N / total" a tenký pruh. Počítadlá: oranžové „still learning", zelené „know".
- **Možnosti** (ikona posuvníkov, panel zdola):
  - „Start with definition",
  - „Starred only" (len keď je niečo označené),
  - „Read term aloud automatically" (predvolene vypnuté).
- **Koniec balíčka:**
  - „You know X · Still learning Y".
  - „Study Y again" (len kartičky z „still learning").
  - „Restart all".
  - „Back to set".
- **Strana s prekladom** zobrazuje blok preklad / definícia / príklady (5.7).
- **Stav kola** kartičiek sa neukladá. Kartičky len aktualizujú `lastStudiedAt` setu.

### 5.6 Výslovnosť

- **Modul `speech`:**
  - `speak(text)` zastaví práve prebiehajúce čítanie a prečíta text.
  - Jazyk `en-US` alebo `en-GB` podľa nastavenia, rýchlosť 0.95.
  - Hlas sa vyberá podľa presnej zhody jazyka, inak akýkoľvek `en-*`.
  - Zoznam hlasov sa načítava asynchrónne (udalosť `voiceschanged`).
- **Kde je reproduktor:** pojmy v zozname setu, náhľad kartičiek, predná strana kartičky, zadanie výberu z možností, zadanie písania naopak, spätná väzba pri písaní anglického pojmu a zoznam na konci kola.
- **Bez `speechSynthesis`** alebo bez anglického hlasu sa reproduktory skryjú a v nastaveniach je vysvetlenie.

### 5.7 Karta: preklad, definícia a príkladové vety

Revízia 2026-10-02. Odpovedná strana slovíčka má až tri časti; druhé dve sú voliteľné, takže nové slovíčko stačí uložiť len s prekladom.

**Terminológia.** Pole `definition` v dátach a v celej špecifikácii je hlavný **preklad** karty (doslovný preklad; môže mať viac variantov oddelených čiarkou, napr. „odchod, odlet"). V rozhraní sa volá **Translation** (predtým „Definition"). Voliteľné pole `meaning` je **Definition** (výklad slova v jazyku pojmu, teda anglicky) a voliteľné pole `examples` je **Examples** (1 alebo 2 príkladové vety, každá na samostatnom riadku). Všade, kde staršie časti špecifikácie hovoria o „definícii" slovíčka ako o odpovedi, myslí sa tým preklad.

**Dáta.**
- `term` (povinné), `definition` = preklad (povinné), `meaning` (voliteľné), `examples` (voliteľné).
- Prázdne alebo len medzerové voliteľné hodnoty sa neukladajú (pole na karte chýba). Pri `examples` sa orežú riadky a prázdne riadky sa vypustia.
- Schéma DB (verzia 1, bez nových indexov), staré karty a staré zálohy ostávajú platné.

**Editor (4.2).**
- Každá kartička má povinné polia Term a Translation. Pod nimi je riadok-tlačidlo „Add definition and examples" (so šípkou, `aria-expanded`), ktoré rozbalí pole Definition a Examples. Definition je viacriadkové pole, ktoré sa automaticky zväčšuje (začína ako jeden riadok a rastie s textom, takže dlhá definícia sa neorezáva); Examples je viacriadkové pole s minimom dvoch riadkov a nápovedou „One or two sentences, one per line.".
- Panel je pri novej kartičke zbalený. Pri úprave sa rozbalí automaticky, ak karta už má Definition alebo Examples. Zbalenie panelu polia len skryje; ich text sa zachová a uloží. Tlačidlo sa volá „Add definition and examples", keď je panel zbalený a prázdny, „Edit definition and examples", keď je zbalený a vyplnený, a „Hide definition and examples", keď je rozbalený.
- Chyby: chýbajúci pojem „Add a term", chýbajúci preklad „Add a translation". Voliteľné polia sa nevalidujú. Kartička je prázdna (a pri uložení sa ignoruje), keď sú prázdne všetky štyri polia; ak je vyplnená len definícia alebo príklad, zobrazia sa chyby pri pojme a preklade.
- Hromadné vloženie (5.3) vytvára len pojem a preklad; voliteľné polia sa dopĺňajú v kartičkách.

**Zobrazenie odpovednej strany** (zoznam slovíčok v 4.3 a strana kartičky s prekladom v 5.5):
- 1. riadok: preklad, **tučne**;
- 2. riadok: definícia, normálne písmo, sekundárna farba textu;
- ďalej príkladové vety *kurzívou* (Figtree 400 italic, self-hosted), každá na samostatnom riadku, sekundárna farba textu.
- Chýbajúce časti sa nezobrazujú a nenechávajú prázdne miesto. Farby len cez tokeny.
- V zozname slovíčok je pojem hlavný nadpis riadku a pod ním blok (preklad polotučne, menšie písmo); na kartičke je preklad tučne a veľký, definícia a príklady menšie pod ním, text je vycentrovaný a dlhý obsah sa v rámci kartičky posúva.

**Kontrola odpovedí.** Learn aj kartičky pracujú len s prekladom: porovnáva sa vždy iba preklad, pri písaní stačí napísať ktorýkoľvek z prekladov oddelených čiarkou (5.4). `meaning` a `examples` sa pri kontrole nikdy nepoužívajú a v otázkach výberu z možností sa nezobrazujú (možnosti sú preklady).

**Zmeny textov v rozhraní.** „Definition" (názov poľa v editore, nadpis zadania v Learn) → „Translation"; „Add a definition" → „Add a translation"; „Choose the matching definition" → „Choose the matching translation"; „Type the definition in Slovak" → „Type the translation in Slovak" (jazyk podľa `definitionLang`); nápoveda pri hromadnom vložení: „Separate term and translation with a dash, tab or comma."

## 6. Dáta

### 6.1 Schéma (Dexie, DB `quizly`, verzia 1)

```ts
interface StudySet {
  id: string;            // crypto.randomUUID()
  title: string;
  definitionLang: string; // BCP 47, napr. 'sk'
  createdAt: number;     // epoch ms
  updatedAt: number;
  lastStudiedAt?: number;
  learnRound: number;    // číslo nasledujúceho kola, začína 1
}

interface Card {
  id: string;
  setId: string;
  term: string;
  definition: string;    // preklad (hlavný, viac variantov oddelených čiarkou); v rozhraní „Translation", pozri 5.7
  position: number;      // poradie v sete
  starred: boolean;
  stage: 0 | 1 | 2 | 3 | 4;
  lastAnsweredAt?: number;
  meaning?: string;      // voliteľná definícia v jazyku pojmu (angličtina); v rozhraní „Definition"
  examples?: string;     // voliteľné 1–2 príkladové vety, každá na samostatnom riadku; v rozhraní „Examples"
}

interface Setting { key: string; value: unknown } // accent, theme, flashcard options
```

Indexy: `sets: id, updatedAt, lastStudiedAt`, `cards: id, setId, [setId+position]`, `settings: key`.

### 6.2 Záloha

- **Formát:** JSON `{ app: 'quizly', version: 1, exportedAt, sets: StudySet[], cards: Card[] }`.
- **Import:**
  - Validuje štruktúru a typy polí. Neplatný súbor ukáže „This file isn't a Quizly backup."
  - Set s rovnakým ID sa nahradí celý, vrátane všetkých jeho kartičiek a pokroku.
  - Zapisuje v jednej transakcii.
  - Nastavenia sa neexportujú.
  - Voliteľné polia `meaning` a `examples` sa exportujú, ak sú vyplnené. Import ich overí (ak sú prítomné, musia to byť reťazce); zálohy bez nich ostávajú platné.

### 6.3 Trvácnosť

- Pri prvom uložení setu appka zavolá `navigator.storage.persist()`, aby prehliadač úložisko nemazal pri nedostatku miesta.
- V nastaveniach je odporúčanie pravidelne exportovať zálohu.

## 7. Architektúra

```
src/
  app/          App, routy, ThemeProvider, InstallPrompt
  db/           schema.ts (Dexie), sets.ts, cards.ts, settings.ts, backup.ts
  features/
    home/       HomePage
    editor/     SetEditorPage, pasteParser.ts
    set/        SetPage
    flashcards/ FlashcardsPage, useFlashcardSession.ts
    learn/      LearnPage, engine.ts, answerCheck.ts, MultipleChoice, WrittenQuestion (oba smery), Feedback, RoundSummary, SetComplete
    settings/   SettingsPage
  lib/          speech.ts, text.ts (normalize, levenshtein), random.ts (RNG s možnosťou seedu pre testy)
  ui/           Button, IconButton, SpeakButton, Card, ProgressBar, TopBar, TabBar, Field, Sheet, InlineConfirm, EmptyState
  styles/       tokens.css, global.css
```

**Hranice:**
- **Čistá logika bez Reactu a DB:** `pasteParser`, `answerCheck`, `learn/engine` a `text`. Dostane dáta, vráti výsledok.
- **`engine.ts`** má funkcie:
  - `buildRound(cards, rng)`,
  - `nextQuestion(roundState)`,
  - `applyAnswer(roundState, cardId, correct)`, ktorá vráti nový stav kola a zmeny `stage`,
  - `pickDistractors(card, cards, rng)`.
- **`db/*`** je jediné miesto, ktoré sa dotýka Dexie. Komponenty volajú funkcie repozitárov a čítajú cez `useLiveQuery`.
- **`speech.ts`** je jediné miesto so `speechSynthesis`.

## 8. PWA a nasadenie

- **Manifest:**
  - `name: 'Quizly'`, `short_name: 'Quizly'`,
  - `start_url: './'`, `scope: './'`, `display: 'standalone'`,
  - `background_color: '#F6F7FB'`, `theme_color: '#4255FF'`,
  - ikony 192, 512 a maskable 512 (monogram „Q" v akcentovej modrej).
- **Service worker:**
  - Precache všetkých súborov buildu vrátane písma.
  - Appka po prvom otvorení funguje bez siete.
  - `autoUpdate`: nová verzia sa aktivuje pri ďalšom spustení.
- **`theme-color` meta:** podľa aktuálnej témy (svetlá `#F6F7FB`, tmavá `#0A092D`), aby systémová lišta ladila s appkou.
- **GitHub Actions** (`.github/workflows/deploy.yml`):
  - pri pushi na `main`: `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact` → `actions/deploy-pages`,
  - GitHub Pages nastavené na zdroj „GitHub Actions".

## 9. Dizajnový systém

Presne podľa schváleného návrhu (`docs/design/screens-v1.html`):

- **Tokeny:** svetlá a tmavá sada farieb z návrhu (`--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-2`, `--line`, `--accent`, `--accent-press`, `--accent-ink`, `--accent-soft`, `--good*`, `--bad*`, `--learning*`, `--star`). Téma sa riadi nastavením (System / Light / Dark) cez `data-theme` na `<html>`.
- **Typografia:** Figtree 400–800. Nadpisy 24–32 px / 700–800, text 15–16 px, meta 13 px.
- **Tvary:** karty 16 px, ovládacie prvky 12 px, čipy pill. Tlačidlá majú min. výšku 48 px, dotykové ciele min. 40 px.
- **Pohyb:**
  - prechody 150–250 ms,
  - otočenie kartičky 420 ms,
  - panel spätnej väzby 240 ms,
  - `prefers-reduced-motion` vypína animácie.
- **Stavy:** každý interaktívny prvok má hover, focus-visible (2 px akcentový obrys), active, disabled. Farby textu spĺňajú WCAG AA.
- **Farby významu:** zelená = viem / správne, oranžová = ešte sa učím, červená = nesprávne, modrá len pre akcie a výber.

### Direction contract (pre impeccable)

- **THESIS:** Quizletov študijný postup, verne a bez paywallu; appka zmizne a ostane len slovíčko, jeho výslovnosť a ďalší krok. Odmieta „inovatívne" rozloženia, ktoré by vlastník musel znova objavovať.
- **OWN-WORLD:** svetlý chladný sivomodrý podklad (`#F6F7FB`) alebo tmavá námornícka (`#0A092D`), biele / `#2E3856` karty so 16 px rohmi, jedna modrá `#4255FF` pre akcie, zelená / oranžová / červená len pre stav učenia, Figtree, ikony Lucide.
- **STORY:** vlastník otvorí appku, jedným ťuknutím pokračuje v Learn, počuje výslovnosť a po kolách vidí, ako rastie počet zvládnutých slovíčok.
- **FIRST VIEWPORT:** Home, wordmark Quizly vľavo hore, karta „Jump back in" s pruhom pokroku a plnošírkovým tlačidlom „Continue learning" v hornej tretine, pod ňou zoznam setov, spodná lišta Home / + / Settings.
- **FORM:** kánon kategórie (pripnutý používateľom: „podobať sa na Quizlet"), bez concept-seed kola.
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## 10. Chybové stavy

| Situácia | Správanie |
|---|---|
| IndexedDB nedostupná (súkromný režim) | celostránková správa „Quizly can't save data in this browser mode. Open it in a normal window." |
| Zlyhanie zápisu | toast „Couldn't save. Try again." a zadané dáta ostanú vo formulári |
| Neplatný súbor zálohy | chyba pri tlačidle importu, nič sa nezapíše |
| Neexistujúci set | „This set doesn't exist" + tlačidlo na Home |
| Bez hlasu / bez TTS | reproduktory skryté, vysvetlenie v nastaveniach |
| Nová verzia appky | aktivuje sa pri ďalšom spustení, bez prerušenia učenia |

## 11. Testovanie

- **Unit testy (Vitest, písané pred kódom):**
  - `pasteParser`: oddeľovače, poradie priority, pomlčky bez medzier, chybné riadky.
  - `answerCheck`: normalizácia, diakritika (aj slovenská), varianty cez `, / ;` v oboch smeroch, `to`/členy len pri angličtine, hranice tolerancie preklepov, krátke slová.
  - `learn/engine`: výber do kola, poradie priorít, typ otázky podľa `stage`, všetky prechody `stage` vrátane návratu o krok pri chybe, opakovanie chýb (max 2×), koniec kola, dokončenie setu (stage 4), distraktory (bez duplicít, malé sety). Deterministické cez seedovaný RNG.
  - `backup`: export → import vráti rovnaké dáta (aj voliteľné polia `meaning` a `examples`), odmietnutie neplatných súborov.
- **Komponentové testy (RTL + `fake-indexeddb`):**
  - vytvorenie setu vložením zoznamu → stránka setu ukáže kartičky,
  - Learn: správny výber → ďalšia otázka toho slovíčka je písanie anglického pojmu, po ňom písanie definície,
  - kartičky: zaradenie a Undo menia počítadlá.
- **Ručné overenie na telefóne:** inštalácia z GitHub Pages, režim lietadla (štart aj učenie), výslovnosť US/UK, svetlá a tmavá téma, systémové tlačidlo Späť.
- **Impeccable:** detektor (`impeccable detect`) nad UI súbormi a záverečná revízia podľa direction contract.

## 12. Nefunkčné požiadavky

- Prvé načítanie pod 2 s na 4G, ďalšie spustenia z cache okamžite.
- JS balík pod 200 kB gzip.
- Ovládanie jednou rukou: hlavné akcie v dolnej polovici obrazovky.
- Rozhranie po anglicky; texty podľa tejto špecifikácie a návrhu.
