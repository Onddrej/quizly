/**
 * Spaced review of mastered cards, counted in lessons (days on which a round was completed) and not in calendar days, so
 * a long break does not make everything due at once. A mastered card is asked again after 3 lessons, then 7, 14, 30 and
 * 60. A right answer moves it one step on, a miss sends it back to learning.
 */

/** Lessons to wait after reaching review step 0, 1, 2, 3 and 4. */
export const REVIEW_INTERVALS = [3, 7, 14, 30, 60] as const;
/** At most this many due cards are mixed into one round of new and in-progress cards. */
export const MAX_REVIEWS_PER_ROUND = 2;

const LAST_STEP = REVIEW_INTERVALS.length - 1;

export interface ReviewSchedule {
  /** 0-4: which interval the card waits for. */
  reviewStep: number;
  /** The lesson number (see `currentLesson`) from which the card is due. */
  nextReviewLesson: number;
}

export function isDue(card: { stage: number; nextReviewLesson?: number }, lesson: number): boolean {
  return card.stage === 4 && card.nextReviewLesson !== undefined && card.nextReviewLesson <= lesson;
}

export function reviewAfterMastered(lesson: number): ReviewSchedule {
  return { reviewStep: 0, nextReviewLesson: lesson + REVIEW_INTERVALS[0] };
}

export function reviewAfterCorrect(step: number, lesson: number): ReviewSchedule {
  const next = Math.min(step + 1, LAST_STEP);
  return { reviewStep: next, nextReviewLesson: lesson + REVIEW_INTERVALS[next] };
}

/** Reviews are typed, never multiple choice, and alternate between the two directions. */
export function reviewQuestionType(step: number): 'write-term' | 'write-definition' {
  return step % 2 === 0 ? 'write-definition' : 'write-term';
}

/**
 * What to change in the review schedule of a card after an answer: a schedule (set it), `null` (clear it) or `undefined`
 * (leave it). `previousStage` is the stage the card had when it was asked, `newStage` the one it has now.
 */
export function reviewPatch(change: {
  previousStage: number;
  newStage: number;
  correct: boolean;
  reviewStep: number | undefined;
  lesson: number;
}): ReviewSchedule | null | undefined {
  const { previousStage, newStage, correct, reviewStep, lesson } = change;
  if (previousStage === 4) return correct ? reviewAfterCorrect(reviewStep ?? 0, lesson) : null;
  if (newStage === 4) return reviewAfterMastered(lesson);
  return undefined;
}
