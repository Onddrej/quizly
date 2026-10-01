import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { createSet } from './sets';
import { type Backup, BackupError, backupFileName, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import { resetDb } from '../test/db';

beforeEach(resetDb);

// A minimal valid backup file as plain JSON data; each test breaks exactly one thing in a copy.
const validSet = () => ({ id: 's', title: 'T', definitionLang: 'sk', createdAt: 1, updatedAt: 2, learnRound: 3 });
const validCard = () => ({ id: 'c', setId: 's', term: 'a', definition: 'b', position: 4, starred: true, stage: 2 as const });
const file = (over: Record<string, unknown> = {}) => ({
  app: 'quizly',
  version: 1,
  exportedAt: '2026-10-01T10:00:00.000Z',
  sets: [validSet()],
  cards: [validCard()],
  ...over,
});
const json = (v: unknown) => JSON.stringify(v);

describe('parseBackup: structure of the file', () => {
  it('accepts a valid file and returns exactly the known fields', () => {
    expect(parseBackup(json(file()))).toStrictEqual(file());
  });

  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"quizly"'],
    ['a number', '42'],
    ['an empty file', ''],
    ['a truncated file', json(file()).slice(0, 60)],
    ['a different app', json(file({ app: 'other' }))],
    ['a missing app', json({ version: 1, sets: [], cards: [] })],
    ['another version', json(file({ version: 2 }))],
    ['a version as text', json(file({ version: '1' }))],
    ['sets that are not an array', json(file({ sets: {} }))],
    ['a missing sets array', json({ app: 'quizly', version: 1, cards: [] })],
    ['cards that are not an array', json(file({ cards: null }))],
    ['a missing cards array', json({ app: 'quizly', version: 1, sets: [] })],
    ['a null set', json(file({ sets: [validSet(), null] }))],
    ['a primitive set', json(file({ sets: [1] }))],
    ['an array as a set', json(file({ sets: [[]] }))],
    ['a null card', json(file({ cards: [validCard(), null] }))],
    ['a primitive card', json(file({ cards: ['c'] }))],
  ])('rejects %s with a BackupError', (_name, text) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
  });

  it('accepts an empty backup and a missing exportedAt', () => {
    const empty = { app: 'quizly', version: 1, sets: [], cards: [] };
    expect(parseBackup(json(empty))).toStrictEqual({ ...empty, exportedAt: '' });
  });

  it('keeps exportedAt, and does not let a __proto__ key into the data', () => {
    const text = '{"__proto__":{"polluted":1},"app":"quizly","version":1,"exportedAt":"x","sets":[{"__proto__":{"x":1},"id":"s","title":"T","definitionLang":"sk","createdAt":1,"updatedAt":2,"learnRound":3}],"cards":[]}';
    const parsed = parseBackup(text);
    expect(parsed.exportedAt).toBe('x');
    expect(Object.keys(parsed.sets[0]).sort()).toEqual(['createdAt', 'definitionLang', 'id', 'learnRound', 'title', 'updatedAt']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('parseBackup: every field is checked', () => {
  const setCases: [string, unknown[]][] = [
    ['id', [undefined, 7, null]],
    ['title', [undefined, 7, null]],
    ['definitionLang', [undefined, 7, null]],
    ['createdAt', [undefined, '1', null]],
    ['updatedAt', [undefined, '1', null]],
    ['learnRound', [undefined, '1', null]],
    ['lastStudiedAt', ['1', null]], // optional: may be absent, but never null or text
  ];
  const cardCases: [string, unknown[]][] = [
    ['id', [undefined, 7, null]],
    ['setId', [undefined, 7, null]],
    ['term', [undefined, 7, null]],
    ['definition', [undefined, 7, null]],
    ['position', [undefined, '1', null]],
    ['starred', [undefined, 'true', 1, null]],
    ['stage', [undefined, '1', null, 5, -1, 1.5]],
    ['lastAnsweredAt', ['1', null]],
  ];

  it.each(setCases.flatMap(([field, values]) => values.map((value) => [field, value] as const)))(
    'rejects a set with %s = %j',
    (field, value) => {
      // no cards here: a card that points at the broken set would be rejected as an orphan and hide a missing check
      expect(() => parseBackup(json(file({ sets: [{ ...validSet(), [field]: value }], cards: [] })))).toThrow(BackupError);
    },
  );

  it.each(cardCases.flatMap(([field, values]) => values.map((value) => [field, value] as const)))(
    'rejects a card with %s = %j',
    (field, value) => {
      expect(() => parseBackup(json(file({ cards: [{ ...validCard(), [field]: value }] })))).toThrow(BackupError);
    },
  );

  it.each(['createdAt', 'updatedAt', 'learnRound', 'lastStudiedAt'])('rejects a set with an infinite %s', (field) => {
    const text = json(file({ sets: [{ ...validSet(), [field]: 123456789 }], cards: [] })).replace('123456789', '1e999');
    expect(() => parseBackup(text)).toThrow(BackupError);
  });

  it.each(['position', 'lastAnsweredAt'])('rejects a card with an infinite %s', (field) => {
    const text = json(file({ cards: [{ ...validCard(), [field]: 123456789 }] })).replace('123456789', '1e999');
    expect(() => parseBackup(text)).toThrow(BackupError);
  });

  it.each([0, 1, 2, 3, 4])('accepts stage %i', (stage) => {
    expect(parseBackup(json(file({ cards: [{ ...validCard(), stage }] }))).cards[0].stage).toBe(stage);
  });

  it('keeps the optional lastStudiedAt and lastAnsweredAt when present, and leaves them out when absent', () => {
    const withBoth = file({ sets: [{ ...validSet(), lastStudiedAt: 99 }], cards: [{ ...validCard(), lastAnsweredAt: 77 }] });
    expect(parseBackup(json(withBoth))).toStrictEqual(withBoth);
    const parsed = parseBackup(json(file()));
    expect('lastStudiedAt' in parsed.sets[0]).toBe(false);
    expect('lastAnsweredAt' in parsed.cards[0]).toBe(false);
  });
});

describe('createBackup, serializeBackup and the file name', () => {
  it('stamps exportedAt with the given time', async () => {
    expect((await createBackup(new Date('2026-10-01T10:00:00Z'))).exportedAt).toBe('2026-10-01T10:00:00.000Z');
    expect(parseBackup(serializeBackup(await createBackup(new Date('2026-10-01T10:00:00Z')))).exportedAt).toBe('2026-10-01T10:00:00.000Z');
  });

  it('pads month and day and uses the local date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 0, 30))).toBe('quizly-backup-2026-01-05.json');
    expect(backupFileName(new Date(2026, 11, 31, 23, 30))).toBe('quizly-backup-2026-12-31.json');
    expect(backupFileName(new Date(2027, 0, 1, 0, 30))).toBe('quizly-backup-2027-01-01.json');
  });
});

describe('export and import round trip keeps every field', () => {
  it('restores identical sets and cards, including optional fields, stars and progress', async () => {
    const a = await createSet(
      { title: 'Ďalší set ľščťžýáíé', definitionLang: 'sk', cards: Array.from({ length: 50 }, (_, i) => ({ term: `slovo ${i}`, definition: `def ĽŠČŤŽ ${i}` })) },
      1000,
    );
    await createSet({ title: 'B', definitionLang: 'cs', cards: [{ term: 'x', definition: 'y' }] }, 2000);
    await db.sets.update(a, { lastStudiedAt: 5555, learnRound: 3 });
    const cs = await db.cards.where('setId').equals(a).toArray();
    await db.cards.update(cs[0].id, { starred: true, stage: 3, lastAnsweredAt: 777 });
    await db.cards.update(cs[1].id, { stage: 4 });
    const read = async () => ({ sets: await db.sets.orderBy('id').toArray(), cards: await db.cards.orderBy('id').toArray() });
    const before = await read();
    const text = serializeBackup(await createBackup());
    await resetDb();
    expect(await importBackup(parseBackup(text))).toEqual({ sets: 2, cards: 51 });
    expect(await read()).toStrictEqual(before);
  });
});

describe('importBackup', () => {
  it('replaces only the sets in the file and leaves other sets, their cards and the not-listed cards alone', async () => {
    const a = await createSet({ title: 'A', definitionLang: 'sk', cards: [{ term: '1', definition: '1' }, { term: '2', definition: '2' }] });
    const b = await createSet({ title: 'B', definitionLang: 'sk', cards: [{ term: 'b', definition: 'b' }] });
    const backup = await createBackup();
    const [first] = await db.cards.where('setId').equals(a).sortBy('position');
    await db.cards.update(first.id, { stage: 4, lastAnsweredAt: 9 });
    await db.cards.add({ id: 'extra', setId: a, term: 'e', definition: 'e', position: 9, starred: true, stage: 2 });
    await db.sets.update(b, { title: 'B-local' });
    const [bCard] = await db.cards.where('setId').equals(b).toArray();
    await db.cards.update(bCard.id, { stage: 3 });

    const onlyA: Backup = { ...backup, sets: backup.sets.filter((s) => s.id === a), cards: backup.cards.filter((c) => c.setId === a) };
    expect(await importBackup(onlyA)).toEqual({ sets: 1, cards: 2 });

    const restored = await db.cards.where('setId').equals(a).sortBy('position');
    expect(restored.map((c) => c.stage)).toEqual([0, 0]);
    expect(restored.some((c) => 'lastAnsweredAt' in c)).toBe(false);
    expect(await db.cards.get('extra')).toBeUndefined();
    expect((await db.sets.get(b))?.title).toBe('B-local');
    expect((await db.cards.where('setId').equals(b).toArray()).map((c) => c.stage)).toEqual([3]);
  });

  it('adds sets that do not exist yet next to the existing ones, and reports the numbers of sets and cards', async () => {
    await createSet({ title: 'Old', definitionLang: 'sk', cards: [{ term: 'o', definition: 'o' }] });
    const backup: Backup = {
      app: 'quizly',
      version: 1,
      exportedAt: '',
      sets: [{ ...validSet(), id: 'n1' }, { ...validSet(), id: 'n2' }],
      cards: [{ ...validCard(), id: 'c1', setId: 'n1' }, { ...validCard(), id: 'c2', setId: 'n1' }, { ...validCard(), id: 'c3', setId: 'n2' }],
    };
    expect(await importBackup(backup)).toEqual({ sets: 2, cards: 3 });
    expect(await db.sets.count()).toBe(3);
    expect(await db.cards.count()).toBe(4);
  });

  it('writes nothing when the import fails midway', async () => {
    const a = await createSet({ title: 'A', definitionLang: 'sk', cards: [{ term: '1', definition: '1' }] });
    const read = async () => ({ sets: await db.sets.toArray(), cards: await db.cards.toArray() });
    const before = await read();
    const backup = await createBackup();
    backup.sets[0].title = 'CHANGED';
    backup.cards.push({ id: 'bad', setId: a, term: (() => 1) as unknown as string, definition: 'd', position: 5, starred: false, stage: 0 });
    await expect(importBackup(backup)).rejects.toBeTruthy();
    expect(await read()).toStrictEqual(before);
  });
});
