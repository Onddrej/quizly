import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { completeRound, createSet } from './sets';
import { listStudyDays, recordStudyDay } from './studyLog';
import { BackupError, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import { localDay } from '../lib/streak';
import { resetDb } from '../test/db';

beforeEach(resetDb);

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe('study days', () => {
  it('starts empty', async () => {
    expect(await listStudyDays()).toEqual([]);
  });

  it('records a day with the number of rounds completed on it', async () => {
    await recordStudyDay(at(2026, 10, 28, 9));
    await recordStudyDay(at(2026, 10, 28, 20));
    expect(await listStudyDays()).toEqual([{ day: '2026-10-28', rounds: 2 }]);
  });

  it('lists the days oldest first, whatever order they were recorded in', async () => {
    await recordStudyDay(at(2026, 10, 28));
    await recordStudyDay(at(2026, 10, 26));
    await recordStudyDay(at(2026, 10, 27));
    expect((await listStudyDays()).map((d) => d.day)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
  });

  it('uses the local calendar day: a round just after midnight belongs to the new day', async () => {
    await recordStudyDay(new Date(2026, 9, 28, 0, 5).getTime());
    await recordStudyDay(new Date(2026, 9, 27, 23, 55).getTime());
    expect((await listStudyDays()).map((d) => d.day)).toEqual(['2026-10-27', '2026-10-28']);
  });
});

describe('completeRound and the study log', () => {
  const draft = { title: 'T', definitionLang: 'sk', cards: [{ term: 'a', definition: 'x' }] };

  it('records today as a study day when a round is completed', async () => {
    const id = await createSet(draft);
    const now = at(2026, 10, 28);
    await completeRound(id, now);
    expect(await listStudyDays()).toEqual([{ day: localDay(now), rounds: 1 }]);
    expect((await db.sets.get(id))?.learnRound).toBe(2);
  });

  it('counts several rounds on one day as one study day', async () => {
    const id = await createSet(draft);
    const now = at(2026, 10, 28);
    await completeRound(id, now);
    await completeRound(id, now + 60_000);
    expect(await listStudyDays()).toEqual([{ day: '2026-10-28', rounds: 2 }]);
  });

  it('changes nothing when saving fails: no day without the round, no round without the day', async () => {
    const id = await createSet(draft);
    const original = db.studyDays.put.bind(db.studyDays);
    db.studyDays.put = (() => Promise.reject(new Error('boom'))) as unknown as typeof db.studyDays.put;
    try {
      await expect(completeRound(id, at(2026, 10, 28))).rejects.toThrow('boom');
    } finally {
      db.studyDays.put = original;
    }
    expect((await db.sets.get(id))?.learnRound).toBe(1);
    expect(await listStudyDays()).toEqual([]);
  });
});

describe('study days in a backup', () => {
  it('are exported and restored', async () => {
    await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'a', definition: 'x' }] });
    await recordStudyDay(at(2026, 10, 27));
    await recordStudyDay(at(2026, 10, 28));
    const text = serializeBackup(await createBackup());
    await resetDb();
    await importBackup(parseBackup(text));
    expect((await listStudyDays()).map((d) => d.day)).toEqual(['2026-10-27', '2026-10-28']);
  });

  it('are merged into the days already on the device, keeping the larger round count', async () => {
    await recordStudyDay(at(2026, 10, 28));
    await recordStudyDay(at(2026, 10, 28));
    const base = { app: 'quizly', version: 1, exportedAt: '', sets: [], cards: [] };
    await importBackup(parseBackup(JSON.stringify({ ...base, studyDays: [{ day: '2026-10-28', rounds: 1 }, { day: '2026-10-20', rounds: 3 }] })));
    expect(await listStudyDays()).toEqual([
      { day: '2026-10-20', rounds: 3 },
      { day: '2026-10-28', rounds: 2 },
    ]);
  });

  it('may be absent: a backup from before study days is still valid', () => {
    const old = { app: 'quizly', version: 1, exportedAt: '', sets: [], cards: [] };
    expect(parseBackup(JSON.stringify(old)).studyDays).toBeUndefined();
  });

  it('must be well formed', () => {
    const base = { app: 'quizly', version: 1, exportedAt: '', sets: [], cards: [] };
    for (const studyDays of ['nope', [{ day: 5, rounds: 1 }], [{ day: '2026-10-28' }], [{ day: 'x', rounds: 1 }], [{ day: '2026-10-28', rounds: 0 }], [{ day: '2026-10-28', rounds: 1.5 }]]) {
      expect(() => parseBackup(JSON.stringify({ ...base, studyDays }))).toThrow(BackupError);
    }
  });
});
