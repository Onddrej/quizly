import { describe, expect, it } from 'vitest';
import { REVIEW_INTERVALS, isDue, reviewAfterCorrect, reviewAfterMastered, reviewPatch, reviewQuestionType } from './review';

describe('REVIEW_INTERVALS', () => {
  it('are 3, 7, 14, 30 and 60 lessons', () => {
    expect([...REVIEW_INTERVALS]).toEqual([3, 7, 14, 30, 60]);
  });
});

describe('isDue', () => {
  it('is true for a mastered card once its lesson has come', () => {
    expect(isDue({ stage: 4, nextReviewLesson: 6 }, 6)).toBe(true);
    expect(isDue({ stage: 4, nextReviewLesson: 6 }, 9)).toBe(true);
  });

  it('is false before that lesson', () => {
    expect(isDue({ stage: 4, nextReviewLesson: 6 }, 5)).toBe(false);
  });

  it('is false for a card that is not mastered, or has no schedule yet', () => {
    expect(isDue({ stage: 3, nextReviewLesson: 1 }, 10)).toBe(false);
    expect(isDue({ stage: 0, nextReviewLesson: 1 }, 10)).toBe(false);
    expect(isDue({ stage: 4 }, 10)).toBe(false);
  });
});

describe('reviewAfterMastered', () => {
  it('schedules the first review 3 lessons ahead', () => {
    expect(reviewAfterMastered(10)).toEqual({ reviewStep: 0, nextReviewLesson: 13 });
  });
});

describe('reviewAfterCorrect', () => {
  it('moves one step on and waits that step\'s interval', () => {
    expect(reviewAfterCorrect(0, 13)).toEqual({ reviewStep: 1, nextReviewLesson: 20 });
    expect(reviewAfterCorrect(1, 20)).toEqual({ reviewStep: 2, nextReviewLesson: 34 });
    expect(reviewAfterCorrect(2, 34)).toEqual({ reviewStep: 3, nextReviewLesson: 64 });
    expect(reviewAfterCorrect(3, 64)).toEqual({ reviewStep: 4, nextReviewLesson: 124 });
  });

  it('stays at the longest interval of 60 lessons', () => {
    expect(reviewAfterCorrect(4, 124)).toEqual({ reviewStep: 4, nextReviewLesson: 184 });
    expect(reviewAfterCorrect(9, 10)).toEqual({ reviewStep: 4, nextReviewLesson: 70 });
  });
});

describe('reviewQuestionType', () => {
  it('asks the translation first and the English term next, alternating', () => {
    expect(reviewQuestionType(0)).toBe('write-definition');
    expect(reviewQuestionType(1)).toBe('write-term');
    expect(reviewQuestionType(2)).toBe('write-definition');
    expect(reviewQuestionType(3)).toBe('write-term');
    expect(reviewQuestionType(4)).toBe('write-definition');
  });
});

describe('reviewPatch', () => {
  const lesson = 10;

  it('schedules the first review when a card becomes mastered', () => {
    expect(reviewPatch({ previousStage: 3, newStage: 4, correct: true, reviewStep: undefined, lesson })).toEqual({ reviewStep: 0, nextReviewLesson: 13 });
  });

  it('does so again when a card that lost its mastery is mastered anew', () => {
    expect(reviewPatch({ previousStage: 3, newStage: 4, correct: true, reviewStep: 2, lesson })).toEqual({ reviewStep: 0, nextReviewLesson: 13 });
  });

  it('moves a reviewed card on when it is answered right', () => {
    expect(reviewPatch({ previousStage: 4, newStage: 4, correct: true, reviewStep: 1, lesson })).toEqual({ reviewStep: 2, nextReviewLesson: 24 });
  });

  it('treats a mastered card without a step as step 0 when it is answered right', () => {
    expect(reviewPatch({ previousStage: 4, newStage: 4, correct: true, reviewStep: undefined, lesson })).toEqual({ reviewStep: 1, nextReviewLesson: 17 });
  });

  it('clears the schedule when a reviewed card is missed, because it goes back to learning', () => {
    expect(reviewPatch({ previousStage: 4, newStage: 2, correct: false, reviewStep: 3, lesson })).toBeNull();
  });

  it('changes nothing for a card on its way to mastery', () => {
    expect(reviewPatch({ previousStage: 0, newStage: 2, correct: true, reviewStep: undefined, lesson })).toBeUndefined();
    expect(reviewPatch({ previousStage: 2, newStage: 3, correct: true, reviewStep: undefined, lesson })).toBeUndefined();
    expect(reviewPatch({ previousStage: 3, newStage: 2, correct: false, reviewStep: undefined, lesson })).toBeUndefined();
  });
});
