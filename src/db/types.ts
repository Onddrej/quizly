export type Stage = 0 | 1 | 2 | 3 | 4;

export interface StudySet {
  id: string;
  title: string;
  definitionLang: string;
  createdAt: number;
  updatedAt: number;
  lastStudiedAt?: number;
  learnRound: number;
}

export interface Card {
  id: string;
  setId: string;
  term: string;
  /** The card's translation (UI label "Translation"); may list comma-separated alternatives. Checked in Learn. */
  definition: string;
  position: number;
  starred: boolean;
  stage: Stage;
  lastAnsweredAt?: number;
  /** Optional definition in the term's language, English (UI label "Definition"). Never checked in Learn. */
  meaning?: string;
  /** Optional example sentences, 1-2, separated by `\n` (UI label "Examples"). Never checked in Learn. */
  examples?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export type Accent = 'en-US' | 'en-GB';
export type ThemePref = 'system' | 'light' | 'dark';

export interface FlashcardPrefs {
  startWithDefinition: boolean;
  starredOnly: boolean;
  autoplay: boolean;
}

export interface Settings {
  accent: Accent;
  theme: ThemePref;
  flashcards: FlashcardPrefs;
}

export const DEFAULT_SETTINGS: Settings = {
  accent: 'en-US',
  theme: 'system',
  flashcards: { startWithDefinition: false, starredOnly: false, autoplay: false },
};
