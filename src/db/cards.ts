import { db } from './schema';
import type { Card, Stage } from './types';

export function listCards(setId: string): Promise<Card[]> {
  return db.cards.where('setId').equals(setId).sortBy('position');
}

export async function setCardStage(cardId: string, stage: Stage, now: number = Date.now()): Promise<void> {
  await db.cards.update(cardId, { stage, lastAnsweredAt: now });
}

export async function toggleStar(cardId: string): Promise<void> {
  await db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(cardId);
    if (card) await db.cards.update(cardId, { starred: !card.starred });
  });
}
