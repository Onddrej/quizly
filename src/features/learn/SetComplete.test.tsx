import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SetComplete } from './SetComplete';

function renderComplete() {
  const onStudyAgain = vi.fn();
  const onBack = vi.fn();
  render(<SetComplete total={2} onStudyAgain={onStudyAgain} onBack={onBack} />);
  return { onStudyAgain, onBack };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SetComplete double tap', () => {
  it('ignores Study again and Back to set right after it appears, and works after a moment', () => {
    const { onStudyAgain, onBack } = renderComplete();
    fireEvent.click(screen.getByRole('button', { name: 'Study again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(onStudyAgain).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Study again' }));
    expect(onStudyAgain).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('leaves the Close button unguarded', () => {
    const { onBack } = renderComplete();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
