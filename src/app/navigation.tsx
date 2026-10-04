import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

// A mirror of the session history: paths[i] is the pathname of the entry at position i. react-router's browser and hash
// histories keep each entry's position in history.state.idx, so a PUSH writes the next slot, a REPLACE overwrites the
// current one and a POP only moves idx; the slots stay correct in every case. Entries ahead of idx are stale until a
// push overwrites them, and nothing reads them.
const paths: string[] = [];

/** Position of the current entry; a memory router (tests) has no history.state, which reads as 0. */
function currentIndex(): number {
  return (window.history.state as { idx?: number } | null)?.idx ?? 0;
}

/** Test helper: forget the mirrored history. */
export function resetNavigationTracking(): void {
  paths.length = 0;
}

/** Records the current page in the history mirror. Render it once, inside the router, above every page. */
export function NavigationTracker() {
  const location = useLocation();
  useEffect(() => {
    paths[currentIndex()] = location.pathname;
  }, [location]);
  return null;
}

/**
 * Returns a callback that leaves the current page for `target` (Close, Back) without growing the history, so the system
 * Back button never reopens the page that was just closed. When `target` is the entry directly behind this one it pops
 * to it; otherwise it replaces the current entry with `target`.
 */
export function useLeave(target: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = currentIndex();
    if (idx > 0 && paths[idx - 1] === target) navigate(-1);
    else navigate(target, { replace: true });
  }, [navigate, target]);
}
