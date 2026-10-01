import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { createSet } from './sets';
import { listCards } from './cards';
import { BackupError, backupFileName, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
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
