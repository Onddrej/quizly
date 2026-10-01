import Dexie, { type EntityTable } from 'dexie';
import type { Card, SettingRow, StudySet } from './types';

export class QuizlyDB extends Dexie {
  sets!: EntityTable<StudySet, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'quizly') {
    super(name);
    this.version(1).stores({
      sets: 'id, updatedAt, lastStudiedAt',
      cards: 'id, setId, [setId+position]',
      settings: 'key',
    });
  }
}

export const db = new QuizlyDB();

/** Opens the database; rejects when IndexedDB is unavailable (e.g. some private browsing modes). */
export async function openDatabase(): Promise<void> {
  await db.open();
}
