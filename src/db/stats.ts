import { db } from './schema';

/** How much is stored on this device (for the diagnostics report). */
export async function getDatabaseStats(): Promise<{ sets: number; cards: number }> {
  const [sets, cards] = await Promise.all([db.sets.count(), db.cards.count()]);
  return { sets, cards };
}
