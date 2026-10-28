import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { setCardStage } from './cards';
import { createSet, resetProgress, scheduleMissingReviews } from './sets';
import { BackupError, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import { resetDb } from '../test/db';

beforeEach(resetDb);

const draft = { title: 'T', definitionLang: 'sk', cards: [{ term: 'a', definition: 'x' }, { term: 'b', definition: 'y' }, { term: 'c', definition: 'z' }] };

async function setup() {
  const id = await createSet(draft);
  const cards = await db.cards.where('setId').equals(id).sortBy('position');
  return { id, cards };
}

const raw = (id: string) => db.cards.get(id) as unknown as Promise<Record<string, unknown>>;

describe('setCardStage and the review schedule', () => {
  it('saves the stage and the answer time, and leaves the schedule alone by default', async () => {
    const { cards } = await setup();
    await db.cards.update(cards[0].id, { reviewStep: 2, nextReviewLesson: 30 });
    await setCardStage(cards[0].id, 4, 123);
    expect(await raw(cards[0].id)).toMatchObject({ stage: 4, lastAnsweredAt: 123, reviewStep: 2, nextReviewLesson: 30 });
  });

  it('saves a schedule with the stage', async () => {
    const { cards } = await setup();
    await setCardStage(cards[0].id, 4, 123, { reviewStep: 0, nextReviewLesson: 13 });
    expect(await raw(cards[0].id)).toMatchObject({ stage: 4, reviewStep: 0, nextReviewLesson: 13 });
  });

  it('removes the schedule, without leaving empty properties behind, when it is cleared', async () => {
    const { cards } = await setup();
    await setCardStage(cards[0].id, 4, 1, { reviewStep: 3, nextReviewLesson: 40 });
    await setCardStage(cards[0].id, 2, 2, null);
    const card = await raw(cards[0].id);
    expect(card).toMatchObject({ stage: 2, lastAnsweredAt: 2 });
    expect(Object.hasOwn(card, 'reviewStep')).toBe(false);
    expect(Object.hasOwn(card, 'nextReviewLesson')).toBe(false);
  });
});

describe('scheduleMissingReviews', () => {
  it('schedules mastered cards that have no schedule yet, 3 lessons ahead, and nothing else', async () => {
    const { id, cards } = await setup();
    await db.cards.update(cards[0].id, { stage: 4 });
    await db.cards.update(cards[1].id, { stage: 4, reviewStep: 2, nextReviewLesson: 50 });
    await db.cards.update(cards[2].id, { stage: 3 });
    await scheduleMissingReviews(id, 10);
    expect(await raw(cards[0].id)).toMatchObject({ reviewStep: 0, nextReviewLesson: 13 });
    expect(await raw(cards[1].id)).toMatchObject({ reviewStep: 2, nextReviewLesson: 50 });
    const open = await raw(cards[2].id);
    expect(Object.hasOwn(open, 'reviewStep')).toBe(false);
    expect(Object.hasOwn(open, 'nextReviewLesson')).toBe(false);
  });

  it('does it once: running it again does not push the first review further away', async () => {
    const { id, cards } = await setup();
    await db.cards.update(cards[0].id, { stage: 4 });
    await scheduleMissingReviews(id, 10);
    await scheduleMissingReviews(id, 20);
    expect(await raw(cards[0].id)).toMatchObject({ nextReviewLesson: 13 });
  });

  it('only touches the given set', async () => {
    const { id, cards } = await setup();
    const other = await createSet(draft);
    const otherCards = await db.cards.where('setId').equals(other).toArray();
    await db.cards.update(cards[0].id, { stage: 4 });
    await db.cards.update(otherCards[0].id, { stage: 4 });
    await scheduleMissingReviews(id, 10);
    expect(Object.hasOwn(await raw(otherCards[0].id), 'nextReviewLesson')).toBe(false);
  });
});

describe('resetProgress and the review schedule', () => {
  it('clears the schedule together with the stages', async () => {
    const { id, cards } = await setup();
    await setCardStage(cards[0].id, 4, 1, { reviewStep: 3, nextReviewLesson: 40 });
    await resetProgress(id);
    const card = await raw(cards[0].id);
    expect(card.stage).toBe(0);
    expect(Object.hasOwn(card, 'reviewStep')).toBe(false);
    expect(Object.hasOwn(card, 'nextReviewLesson')).toBe(false);
  });
});

describe('the review schedule in a backup', () => {
  it('is exported and restored', async () => {
    const { cards } = await setup();
    await setCardStage(cards[0].id, 4, 1, { reviewStep: 1, nextReviewLesson: 20 });
    const text = serializeBackup(await createBackup());
    await resetDb();
    await importBackup(parseBackup(text));
    expect(await raw(cards[0].id)).toMatchObject({ reviewStep: 1, nextReviewLesson: 20 });
  });

  it('may be absent: a backup from before spaced review is still valid', async () => {
    const { cards } = await setup();
    const parsed = parseBackup(serializeBackup(await createBackup()));
    expect(Object.hasOwn(parsed.cards.find((c) => c.id === cards[0].id)!, 'reviewStep')).toBe(false);
  });

  it('must be well formed', async () => {
    const { cards } = await setup();
    const backup = await createBackup();
    const bad = [{ reviewStep: 5 }, { reviewStep: -1 }, { reviewStep: 1.5 }, { reviewStep: 'x' }, { nextReviewLesson: 0 }, { nextReviewLesson: 1.5 }, { nextReviewLesson: 'x' }];
    for (const extra of bad) {
      const file = { ...backup, cards: backup.cards.map((c) => (c.id === cards[0].id ? { ...c, ...extra } : c)) };
      expect(() => parseBackup(JSON.stringify(file))).toThrow(BackupError);
    }
  });
});
