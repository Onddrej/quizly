import { db } from './schema';
import { tracedTransaction } from './trace';
import type { Card, Stage } from './types';
import { diagnostics } from '../lib/diagnostics';

export function listCards(setId: string): Promise<Card[]> {
  return db.cards.where('setId').equals(setId).sortBy('position');
}

export function setCardStage(cardId: string, stage: Stage, now: number = Date.now()): Promise<void> {
  return diagnostics.trace('setCardStage', async () => {
    await db.cards.update(cardId, { stage, lastAnsweredAt: now });
  });
}

export async function toggleStar(cardId: string): Promise<void> {
  await tracedTransaction('toggleStar', 'rw', [db.cards], async () => {
    const card = await db.cards.get(cardId);
    if (card) await db.cards.update(cardId, { starred: !card.starred });
  });
}
