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
  definition: string;
  position: number;
  starred: boolean;
  stage: Stage;
  lastAnsweredAt?: number;
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
