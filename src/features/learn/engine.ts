import type { Card, Stage } from '../../db/types';
import { normalize } from '../../lib/text';
import { defaultRng, shuffle, type Rng } from '../../lib/random';

export type QuestionType = 'choice' | 'write-term' | 'write-definition';

export const ROUND_SIZE = 7;
export const MAX_RETRIES_PER_CARD = 2;

export interface RoundState {
  cardIds: string[];
  queue: string[];
  attempts: Record<string, number>;
  firstTry: Record<string, boolean>;
  stages: Record<string, Stage>;
  startStages: Record<string, Stage>;
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

/** Correct moves one step forward; a mistake moves back one question type (spec 5.1). */
export function stageAfter(stage: Stage, correct: boolean): Stage {
  if (correct) {
    if (stage <= 1) return 2;
    if (stage === 2) return 3;
    return 4;
  }
  return stage === 3 ? 2 : 1;
}

export function selectRoundCards(cards: readonly Card[], size = ROUND_SIZE): Card[] {
  const open = cards.filter((c) => c.stage < 4);
  const inProgress = open
    .filter((c) => c.stage > 0)
    .sort((a, b) => (a.lastAnsweredAt ?? 0) - (b.lastAnsweredAt ?? 0) || a.position - b.position);
  const fresh = open.filter((c) => c.stage === 0).sort((a, b) => a.position - b.position);
  return [...inProgress, ...fresh].slice(0, size);
}

export function startRound(cards: readonly Card[], rng: Rng = defaultRng, size = ROUND_SIZE): RoundState {
  const picked = selectRoundCards(cards, size);
  const ids = picked.map((c) => c.id);
  const stages: Record<string, Stage> = Object.fromEntries(picked.map((c) => [c.id, c.stage]));
  return { cardIds: ids, queue: shuffle(ids, rng), attempts: {}, firstTry: {}, stages, startStages: { ...stages } };
}

export function currentCardId(state: RoundState): string | null {
  return state.queue[0] ?? null;
}

export function isRoundFinished(state: RoundState): boolean {
  return state.queue.length === 0;
}

export function answer(state: RoundState, correct: boolean): { state: RoundState; stage: Stage } {
  const id = state.queue[0];
  if (id === undefined) throw new Error('Round is already finished');
  const attempts = (state.attempts[id] ?? 0) + 1;
  const stage = stageAfter(state.stages[id], correct);
  const rest = state.queue.slice(1);
  const retry = !correct && attempts <= MAX_RETRIES_PER_CARD;
  return {
    stage,
    state: {
      ...state,
      queue: retry ? [...rest, id] : rest,
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

/** The correct definition plus up to `count - 1` distinct definitions from the same set, shuffled. */
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

export function isSetMastered(cards: readonly Card[]): boolean {
  return cards.length > 0 && cards.every((c) => c.stage === 4);
}
