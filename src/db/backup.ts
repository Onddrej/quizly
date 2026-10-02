import { db } from './schema';
import type { Card, Stage, StudySet } from './types';
import { requestPersistentStorage } from '../lib/storage';

export interface Backup {
  app: 'quizly';
  version: 1;
  exportedAt: string;
  sets: StudySet[];
  cards: Card[];
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
  const { sets, cards } = await db.transaction('r', db.sets, db.cards, async () => ({
    sets: await db.sets.toArray(),
    cards: await db.cards.toArray(),
  }));
  const setIds = new Set(sets.map((s) => s.id));
  return { app: 'quizly', version: 1, exportedAt: now.toISOString(), sets, cards: cards.filter((c) => setIds.has(c.setId)) };
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
  if (meaning !== undefined) card.meaning = meaning;
  if (examples !== undefined) card.examples = examples;
  return card;
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
  return {
    app: 'quizly',
    version: 1,
    exportedAt: isString(data.exportedAt) ? data.exportedAt : '',
    sets: validSets,
    cards: validCards,
  };
}

/**
 * Sets with the same id are replaced together with all their cards; everything runs in one transaction. Once it has
 * committed, asks the browser for persistent storage (spec 6.3): restoring a backup into a fresh profile is the first save there.
 */
export async function importBackup(backup: Backup): Promise<{ sets: number; cards: number }> {
  await db.transaction('rw', db.sets, db.cards, async () => {
    for (const set of backup.sets) {
      await db.cards.where('setId').equals(set.id).delete();
    }
    await db.sets.bulkPut(backup.sets);
    await db.cards.bulkPut(backup.cards);
  });
  void requestPersistentStorage();
  return { sets: backup.sets.length, cards: backup.cards.length };
}
