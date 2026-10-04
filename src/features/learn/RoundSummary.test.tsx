import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Card } from '../../db/types';
import { RoundSummary } from './RoundSummary';

const card: Card = { id: 'c1', setId: 's1', term: 'luggage', definition: 'batožina', position: 0, starred: false, stage: 2 };

function renderSummary() {
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(
    <RoundSummary
      roundNumber={1}
      summary={{ total: 1, correctFirstTry: 1, newlyMastered: [], results: [{ cardId: 'c1', stage: 2, firstTry: true }] }}
      cards={new Map([[card.id, card]])}
      counts={{ mastered: 0, learning: 1, notStudied: 0 }}
      allMastered={false}
      onContinue={onContinue}
      onBack={onBack}
    />,
  );
  return { onContinue, onBack };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('RoundSummary double tap', () => {
  it('ignores Continue and Back to set right after it appears, and works after a moment', () => {
    const { onContinue, onBack } = renderSummary();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to round 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(onContinue).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to round 2' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
