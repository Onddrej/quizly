import { db } from './schema';
import { tracedTransaction } from './trace';
import type { Card, Stage, StudyDay, StudySet } from './types';
import { normalizeCardDetails } from '../lib/cardDetails';
import { requestPersistentStorage } from '../lib/storage';

export interface Backup {
  app: 'quizly';
  version: 1;
  exportedAt: string;
  sets: StudySet[];
  cards: Card[];
  /** The study log (streak and lessons). Absent in backups made before it existed, which stay valid. */
  studyDays?: StudyDay[];
}

export class BackupError extends Error {
  constructor() {
    super("This file isn't a Quizly backup.");
    this.name = 'BackupError';
  }
}

/**
 * Reads both tables in one read transaction (one consistent snapshot) and leaves out cards whose set is missing:
 * parseBackup rejects the whole file because of a single orphan card, and the owner must always be able to restore their own backup.
 */
export async function createBackup(now: Date = new Date()): Promise<Backup> {
  const { sets, cards, studyDays } = await tracedTransaction('createBackup', 'r', [db.sets, db.cards, db.studyDays], async () => ({
    sets: await db.sets.toArray(),
    cards: await db.cards.toArray(),
    studyDays: await db.studyDays.orderBy('day').toArray(),
  }));
  const setIds = new Set(sets.map((s) => s.id));
  return { app: 'quizly', version: 1, exportedAt: now.toISOString(), sets, cards: cards.filter((c) => setIds.has(c.setId)), studyDays };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `quizly-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const STAGES = new Set<unknown>([0, 1, 2, 3, 4]);

function toSet(value: unknown): StudySet | null {
  if (!isObject(value)) return null;
  const { id, title, definitionLang, createdAt, updatedAt, lastStudiedAt, learnRound } = value;
  if (!isString(id) || !isString(title) || !isString(definitionLang)) return null;
  if (!isNumber(createdAt) || !isNumber(updatedAt) || !isNumber(learnRound)) return null;
  if (lastStudiedAt !== undefined && !isNumber(lastStudiedAt)) return null;
  const set: StudySet = { id, title, definitionLang, createdAt, updatedAt, learnRound };
  if (lastStudiedAt !== undefined) set.lastStudiedAt = lastStudiedAt;
  return set;
}

function toCard(value: unknown): Card | null {
  if (!isObject(value)) return null;
  const { id, setId, term, definition, position, starred, stage, lastAnsweredAt, meaning, examples } = value;
  if (!isString(id) || !isString(setId) || !isString(term) || !isString(definition)) return null;
  if (!isNumber(position) || typeof starred !== 'boolean' || !STAGES.has(stage)) return null;
  if (lastAnsweredAt !== undefined && !isNumber(lastAnsweredAt)) return null;
  if (meaning !== undefined && !isString(meaning)) return null;
  if (examples !== undefined && !isString(examples)) return null;
  const card: Card = { id, setId, term, definition, position, starred, stage: stage as Stage };
  if (lastAnsweredAt !== undefined) card.lastAnsweredAt = lastAnsweredAt;
  // blank or whitespace-only extras (hand-edited or foreign files) are not stored, same as when a card is saved (spec 5.7)
  Object.assign(card, normalizeCardDetails({ meaning, examples }));
  return card;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function toStudyDay(value: unknown): StudyDay | null {
  if (!isObject(value)) return null;
  const { day, rounds } = value;
  if (!isString(day) || !DAY.test(day) || !isNumber(rounds) || !Number.isInteger(rounds) || rounds < 1) return null;
  return { day, rounds };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError();
  }
  if (!isObject(data) || data.app !== 'quizly' || data.version !== 1) throw new BackupError();
  if (!Array.isArray(data.sets) || !Array.isArray(data.cards)) throw new BackupError();
  const sets = data.sets.map(toSet);
  const cards = data.cards.map(toCard);
  if (sets.some((s) => s === null) || cards.some((c) => c === null)) throw new BackupError();
  const validSets = sets as StudySet[];
  const validCards = cards as Card[];
  const setIds = new Set(validSets.map((s) => s.id));
  if (validCards.some((c) => !setIds.has(c.setId))) throw new BackupError();
  const backup: Backup = {
    app: 'quizly',
    version: 1,
    exportedAt: isString(data.exportedAt) ? data.exportedAt : '',
    sets: validSets,
    cards: validCards,
  };
  if (data.studyDays !== undefined) {
    if (!Array.isArray(data.studyDays)) throw new BackupError();
    const days = data.studyDays.map(toStudyDay);
    if (days.some((d) => d === null)) throw new BackupError();
    backup.studyDays = days as StudyDay[];
  }
  return backup;
}

/** How many of the backup's sets are already on this device (matched by id), so importing them would replace them and their progress. Reads only. */
export async function countExistingSets(backup: Backup): Promise<number> {
  return (await db.sets.bulkGet(backup.sets.map((s) => s.id))).filter(Boolean).length;
}

/**
 * Sets with the same id are replaced together with all their cards; everything runs in one transaction. Once it has
 * committed, asks the browser for persistent storage (spec 6.3): restoring a backup into a fresh profile is the first save there.
 */
export async function importBackup(backup: Backup): Promise<{ sets: number; cards: number }> {
  await tracedTransaction('importBackup', 'rw', [db.sets, db.cards, db.studyDays], async () => {
    for (const set of backup.sets) {
      await db.cards.where('setId').equals(set.id).delete();
    }
    await db.sets.bulkPut(backup.sets);
    await db.cards.bulkPut(backup.cards);
    // study days are merged into the ones on this device (the larger round count wins), never replaced: the streak is
    // history, and restoring an older backup must not shorten it
    for (const incoming of backup.studyDays ?? []) {
      const existing = await db.studyDays.get(incoming.day);
      await db.studyDays.put({ day: incoming.day, rounds: Math.max(incoming.rounds, existing?.rounds ?? 0) });
    }
  });
  void requestPersistentStorage();
  return { sets: backup.sets.length, cards: backup.cards.length };
}
