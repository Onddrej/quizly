import { db } from './schema';
import { DEFAULT_SETTINGS, type Settings } from './types';

export async function loadSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    flashcards: { ...DEFAULT_SETTINGS.flashcards, ...(stored.flashcards ?? {}) },
  };
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}
