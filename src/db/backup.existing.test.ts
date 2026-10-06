import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { createSet } from './sets';
import { type Backup, countExistingSets, createBackup } from './backup';
import { resetDb } from '../test/db';

beforeEach(resetDb);

const newSet = (title: string) => createSet({ title, definitionLang: 'sk', cards: [{ term: 'a', definition: 'b' }] });

describe('countExistingSets', () => {
  it('counts none when the backup comes from another device', async () => {
    await newSet('Travel');
    await newSet('Food');
    const backup = await createBackup();
    await resetDb();
    expect(await countExistingSets(backup)).toBe(0);
  });

  it('counts only the sets that are on this device, matched by id', async () => {
    const travel = await newSet('Travel');
    await newSet('Food');
    await newSet('Work');
    const backup = await createBackup();
    await db.sets.delete(travel);
    await db.cards.where('setId').equals(travel).delete();
    expect(await countExistingSets(backup)).toBe(2);
  });

  it('counts all of them when every set is already here', async () => {
    await newSet('Travel');
    await newSet('Food');
    expect(await countExistingSets(await createBackup())).toBe(2);
  });

  it('counts none for a backup without sets', async () => {
    await newSet('Travel');
    const empty: Backup = { app: 'quizly', version: 1, exportedAt: '', sets: [], cards: [] };
    expect(await countExistingSets(empty)).toBe(0);
  });
});
