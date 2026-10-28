import Dexie, { type EntityTable } from 'dexie';
import type { Card, SettingRow, StudyDay, StudySet } from './types';
import { diagnostics } from '../lib/diagnostics';

export class QuizlyDB extends Dexie {
  sets!: EntityTable<StudySet, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  studyDays!: EntityTable<StudyDay, 'day'>;

  constructor(name = 'quizly') {
    super(name);
    this.version(1).stores({
      sets: 'id, updatedAt, lastStudiedAt',
      cards: 'id, setId, [setId+position]',
      settings: 'key',
    });
    // version 2 adds the study log; the other tables carry over unchanged
    this.version(2).stores({ studyDays: 'day' });
  }
}

export const db = new QuizlyDB();

/** Opens the database; rejects when IndexedDB is unavailable (e.g. some private browsing modes). */
export function openDatabase(): Promise<void> {
  return diagnostics.trace('openDatabase', async () => {
    await db.open();
  });
}
