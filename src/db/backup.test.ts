import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './schema';
import { createSet } from './sets';
import { listCards } from './cards';
import { type Backup, BackupError, backupFileName, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import { resetDb } from '../test/db';

beforeEach(resetDb);

describe('backup', () => {
  it('round-trips sets and cards through export and import', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] }, 1000);
    const text = serializeBackup(await createBackup(new Date('2026-10-01T10:00:00Z')));
    await resetDb();
    const result = await importBackup(parseBackup(text));
    expect(result).toEqual({ sets: 1, cards: 1 });
    expect((await db.sets.get(id))?.title).toBe('Travel');
    expect((await listCards(id))[0].term).toBe('gate');
  });

  it('replaces a set with the same id together with its cards', async () => {
    const id = await createSet({
      title: 'Travel',
      definitionLang: 'sk',
      cards: [
        { term: 'a', definition: '1' },
        { term: 'b', definition: '2' },
        { term: 'c', definition: '3' },
      ],
    });
    const backup = await createBackup();
    backup.cards = backup.cards.slice(0, 2);
    await importBackup(backup);
    expect(await listCards(id)).toHaveLength(2);
  });

  it('rejects files that are not Quizly backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"foo":1}')).toThrow("This file isn't a Quizly backup.");
    const badStage = {
      app: 'quizly',
      version: 1,
      exportedAt: '',
      sets: [{ id: 's', title: 'T', definitionLang: 'sk', createdAt: 1, updatedAt: 1, learnRound: 1 }],
      cards: [{ id: 'c', setId: 's', term: 'a', definition: 'b', position: 0, starred: false, stage: 9 }],
    };
    expect(() => parseBackup(JSON.stringify(badStage))).toThrow(BackupError);
    const orphan = { ...badStage, cards: [{ ...badStage.cards[0], stage: 0, setId: 'missing' }] };
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow(BackupError);
  });

  it('names the file with the local date', () => {
    expect(backupFileName(new Date(2026, 9, 1))).toBe('quizly-backup-2026-10-01.json');
  });
});

describe('createBackup and orphan cards', () => {
  it('skips cards whose set is missing, so the owner can always import their own backup', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] }, 1000);
    await db.cards.add({ id: 'orphan', setId: 'gone', term: 'x', definition: 'y', position: 0, starred: false, stage: 0 });
    const backup = await createBackup();
    expect(backup.sets.map((s) => s.id)).toEqual([id]);
    expect(backup.cards.map((c) => c.term)).toEqual(['gate']);
    const text = serializeBackup(await createBackup());
    expect(() => parseBackup(text)).not.toThrow();
  });
});

describe('persistent storage (spec 6.3)', () => {
  it('importBackup asks the browser for persistent storage', async () => {
    const backup: Backup = {
      app: 'quizly',
      version: 1,
      exportedAt: '',
      sets: [{ id: 's', title: 'T', definitionLang: 'sk', createdAt: 1, updatedAt: 1, learnRound: 1 }],
      cards: [{ id: 'c', setId: 's', term: 'a', definition: 'b', position: 0, starred: false, stage: 0 }],
    };
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => false, persist } });
    try {
      await importBackup(backup);
      await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    } finally {
      delete (navigator as unknown as { storage?: unknown }).storage;
    }
  });
});
