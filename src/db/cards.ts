import { db } from './schema';
import { tracedTransaction } from './trace';
import type { Card, Stage } from './types';
import { diagnostics } from '../lib/diagnostics';
import type { ReviewSchedule } from '../lib/review';

export function listCards(setId: string): Promise<Card[]> {
  return db.cards.where('setId').equals(setId).sortBy('position');
}

/**
 * Saves a card's stage and answer time. `review` changes its spaced review schedule: a schedule sets it, `null` clears it
 * (the properties are removed, never stored as empty values) and `undefined` leaves it as it is.
 */
export function setCardStage(cardId: string, stage: Stage, now: number = Date.now(), review?: ReviewSchedule | null): Promise<void> {
  return diagnostics.trace('setCardStage', async () => {
    const changes: Record<string, unknown> = { stage, lastAnsweredAt: now };
    if (review === null) {
      changes.reviewStep = undefined; // Dexie removes a property that is updated to undefined
      changes.nextReviewLesson = undefined;
    } else if (review) {
      changes.reviewStep = review.reviewStep;
      changes.nextReviewLesson = review.nextReviewLesson;
    }
    await db.cards.update(cardId, changes);
  });
}

export async function toggleStar(cardId: string): Promise<void> {
  await tracedTransaction('toggleStar', 'rw', [db.cards], async () => {
    const card = await db.cards.get(cardId);
    if (card) await db.cards.update(cardId, { starred: !card.starred });
  });
}
