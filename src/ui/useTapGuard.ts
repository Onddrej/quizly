import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns `guard`, which wraps a tap handler so it is ignored during the first `ms` milliseconds after the component
 * mounts. A double tap on the button that opens a screen would otherwise land a second tap on whatever sits under the
 * same finger on the new screen (such as "Back to set", or "Study again", which resets progress).
 */
export function useTapGuard(ms = 350): (action: () => void) => () => void {
  const ready = useRef(false);
  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => {
      ready.current = true;
    }, ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return useCallback(
    (action) => () => {
      if (ready.current) action();
    },
    [],
  );
}
