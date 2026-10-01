export type Rng = () => number;

/**
 * mulberry32: small seedable generator, used to make tests deterministic.
 * The seed is truncated to an unsigned 32-bit integer.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Looks Math.random up on every call, so tests can spy on it. */
export const defaultRng: Rng = () => Math.random();

/** Returns a new, shuffled array and never mutates the input. rng must return values in [0, 1). */
export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
