export type SortResult = 'know' | 'learning';

export interface FlashcardState {
  order: string[];
  index: number;
  results: Record<string, SortResult>;
  history: string[];
  flipped: boolean;
}

export type FlashcardAction =
  | { type: 'start'; order: string[] }
  | { type: 'flip' }
  | { type: 'sort'; result: SortResult }
  | { type: 'undo' };

export function initialFlashcardState(order: string[]): FlashcardState {
  return { order, index: 0, results: {}, history: [], flipped: false };
}

export function flashcardReducer(state: FlashcardState, action: FlashcardAction): FlashcardState {
  switch (action.type) {
    case 'start':
      return initialFlashcardState(action.order);
    case 'flip':
      return state.index < state.order.length ? { ...state, flipped: !state.flipped } : state;
    case 'sort': {
      const id = state.order[state.index];
      if (id === undefined) return state;
      return {
        ...state,
        index: state.index + 1,
        results: { ...state.results, [id]: action.result },
        history: [...state.history, id],
        flipped: false,
      };
    }
    case 'undo': {
      const id = state.history[state.history.length - 1];
      if (id === undefined) return state;
      const results = { ...state.results };
      delete results[id];
      return { ...state, index: state.index - 1, results, history: state.history.slice(0, -1), flipped: false };
    }
  }
}

export function isFinished(state: FlashcardState): boolean {
  return state.order.length > 0 && state.index >= state.order.length;
}

export function tally(state: FlashcardState): { know: number; learning: number; learningIds: string[] } {
  const learningIds = state.history.filter((id) => state.results[id] === 'learning');
  return { know: state.history.length - learningIds.length, learning: learningIds.length, learningIds };
}
