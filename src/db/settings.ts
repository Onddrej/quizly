import { db } from './schema';
import { DEFAULT_SETTINGS, type Settings } from './types';
import { diagnostics } from '../lib/diagnostics';

export function loadSettings(): Promise<Settings> {
  return diagnostics.trace('loadSettings', async () => {
    const rows = await db.settings.toArray();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      flashcards: { ...DEFAULT_SETTINGS.flashcards, ...(stored.flashcards ?? {}) },
    };
  });
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  return diagnostics.trace('saveSetting', async () => {
    await db.settings.put({ key, value });
  });
}
