import type { Card, Stage } from '../../db/types';
import { normalize } from '../../lib/text';
import { defaultRng, shuffle, type Rng } from '../../lib/random';
import { MAX_REVIEWS_PER_ROUND, isDue, reviewQuestionType } from '../../lib/review';

export type QuestionType = 'choice' | 'write-term' | 'write-definition';

export const ROUND_SIZE = 7;

export interface RoundState {
  cardIds: string[];
  queue: string[];
  attempts: Record<string, number>;
  firstTry: Record<string, boolean>;
  stages: Record<string, Stage>;
  startStages: Record<string, Stage>;
  /** Review step of the cards that were mastered when the round started: they are asked again (spaced review). */
  reviewSteps?: Record<string, number>;
}

export interface RoundResult {
  cardId: string;
  stage: Stage;
  firstTry: boolean;
}

export interface RoundSummary {
  total: number;
  correctFirstTry: number;
  newlyMastered: string[];
  results: RoundResult[];
}

/** Stage 4 (mastered) is never asked. */
export function questionTypeFor(stage: Stage): QuestionType | null {
  if (stage <= 1) return 'choice';
  if (stage === 2) return 'write-term';
  if (stage === 3) return 'write-definition';
  return null;
}

/** The question a card is asked in this round: its stage's type, or for a mastered card being reviewed, a typed question. */
export function questionTypeOf(state: RoundState, id: string): QuestionType | null {
  const step = state.reviewSteps?.[id];
  if (step !== undefined && state.stages[id] === 4) return reviewQuestionType(step);
  return questionTypeFor(state.stages[id]);
}

/** Correct moves one step forward; a mistake moves back one question type (spec 5.1). A missed mastered card (a review) goes back to typing the English term. */
export function stageAfter(stage: Stage, correct: boolean): Stage {
  if (correct) {
    if (stage <= 1) return 2;
    if (stage === 2) return 3;
    return 4;
  }
  return stage >= 3 ? 2 : 1;
}

/**
 * In-progress cards (stage 1-3, longest unseen first) before new ones (set order), at most `size`. Mastered cards are
 * picked only for review: given the current `lesson`, up to MAX_REVIEWS_PER_ROUND due cards (most overdue first) are
 * added to the learning cards, and a set with nothing left to learn gets a round of due cards only.
 */
export function selectRoundCards(cards: readonly Card[], size = ROUND_SIZE, lesson?: number): Card[] {
  const open = cards.filter((c) => c.stage < 4);
  const inProgress = open
    .filter((c) => c.stage > 0)
    .sort((a, b) => (a.lastAnsweredAt ?? 0) - (b.lastAnsweredAt ?? 0) || a.position - b.position);
  const fresh = open.filter((c) => c.stage === 0).sort((a, b) => a.position - b.position);
  const learn = [...inProgress, ...fresh];
  const due =
    lesson === undefined
      ? []
      : cards.filter((c) => isDue(c, lesson)).sort((a, b) => (a.nextReviewLesson ?? 0) - (b.nextReviewLesson ?? 0) || a.position - b.position);
  if (learn.length === 0) return due.slice(0, size);
  const reviews = due.slice(0, Math.min(MAX_REVIEWS_PER_ROUND, size - 1));
  return [...learn.slice(0, size - reviews.length), ...reviews];
}

/** Builds a round from the picked cards at their saved stages, in shuffled order. Returns an already finished round (empty queue) when nothing is left to learn, so check isSetMastered first. */
export function startRound(cards: readonly Card[], rng: Rng = defaultRng, size = ROUND_SIZE, lesson?: number): RoundState {
  const picked = selectRoundCards(cards, size, lesson);
  const ids = picked.map((c) => c.id);
  const stages: Record<string, Stage> = Object.fromEntries(picked.map((c) => [c.id, c.stage]));
  const reviewSteps = Object.fromEntries(picked.filter((c) => c.stage === 4).map((c) => [c.id, c.reviewStep ?? 0]));
  return { cardIds: ids, queue: shuffle(ids, rng), attempts: {}, firstTry: {}, stages, startStages: { ...stages }, reviewSteps };
}

export function currentCardId(state: RoundState): string | null {
  return state.queue[0] ?? null;
}

export function isRoundFinished(state: RoundState): boolean {
  return state.queue.length === 0;
}

/** Pure: returns the next state and the card's new stage; never mutates its input. Throws when the round is already finished. A wrong card goes to the end of the queue and stays in the round until it is answered correctly. */
export function answer(state: RoundState, correct: boolean): { state: RoundState; stage: Stage } {
  const id = state.queue[0];
  if (id === undefined) throw new Error('Round is already finished');
  const attempts = (state.attempts[id] ?? 0) + 1;
  const stage = stageAfter(state.stages[id], correct);
  const rest = state.queue.slice(1);
  return {
    stage,
    state: {
      ...state,
      queue: correct ? rest : [...rest, id],
      attempts: { ...state.attempts, [id]: attempts },
      firstTry: id in state.firstTry ? state.firstTry : { ...state.firstTry, [id]: correct },
      stages: { ...state.stages, [id]: stage },
    },
  };
}

export function summarizeRound(state: RoundState): RoundSummary {
  return {
    total: state.cardIds.length,
    correctFirstTry: state.cardIds.filter((id) => state.firstTry[id]).length,
    newlyMastered: state.cardIds.filter((id) => state.stages[id] === 4 && state.startStages[id] !== 4),
    results: state.cardIds.map((id) => ({ cardId: id, stage: state.stages[id], firstTry: state.firstTry[id] ?? false })),
  };
}

/**
 * The correct definition plus up to `count - 1` distinct definitions from the same set, shuffled.
 * May return fewer than `count` options, even a single one (tiny sets, or every card shares the definition); callers must cope.
 */
export function pickChoices(target: Card, all: readonly Card[], rng: Rng = defaultRng, count = 4): string[] {
  const seen = new Set([normalize(target.definition)]);
  const distractors: string[] = [];
  for (const other of shuffle(all.filter((c) => c.id !== target.id), rng)) {
    const key = normalize(other.definition);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(other.definition);
    if (distractors.length === count - 1) break;
  }
  return shuffle([target.definition, ...distractors], rng);
}

/** Every card is mastered and (given the current `lesson`) none is due for review. */
export function isSetMastered(cards: readonly Card[], lesson?: number): boolean {
  return cards.length > 0 && cards.every((c) => c.stage === 4) && (lesson === undefined || !cards.some((c) => isDue(c, lesson)));
}
