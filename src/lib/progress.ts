import type { Stage } from '../db/types';

export type Status = 'not-studied' | 'learning' | 'mastered';

export interface StatusCounts {
  mastered: number;
  learning: number;
  notStudied: number;
}

export function statusOf(stage: Stage): Status {
  if (stage === 0) return 'not-studied';
  if (stage === 4) return 'mastered';
  return 'learning';
}

export function countStatuses(items: ReadonlyArray<{ stage: Stage }>): StatusCounts {
  const counts: StatusCounts = { mastered: 0, learning: 0, notStudied: 0 };
  for (const item of items) {
    const status = statusOf(item.stage);
    if (status === 'mastered') counts.mastered++;
    else if (status === 'learning') counts.learning++;
    else counts.notStudied++;
  }
  return counts;
}
