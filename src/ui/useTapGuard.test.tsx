import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTapGuard } from './useTapGuard';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useTapGuard', () => {
  it('ignores the wrapped action until 350 ms after mount, then runs it', () => {
    const { result } = renderHook(() => useTapGuard());
    const action = vi.fn();
    const tap = result.current(action);
    tap();
    expect(action).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(349);
    });
    tap();
    expect(action).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    tap();
    tap();
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('uses the given delay', () => {
    const { result } = renderHook(() => useTapGuard(1000));
    const action = vi.fn();
    act(() => {
      vi.advanceTimersByTime(999);
    });
    result.current(action)();
    expect(action).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    result.current(action)();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('keeps the guard wrapper stable between renders and clears its timer on unmount', () => {
    const { result, rerender, unmount } = renderHook(() => useTapGuard());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
