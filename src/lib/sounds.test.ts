import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playCorrect, playWrong, resetSoundsForTests } from './sounds';

interface Tone {
  frequency: number;
  type: string;
  started: number | null;
  stopped: number | null;
}

/** A recording stand-in for the Web Audio API: every oscillator that gets started is kept in `tones`. */
function stubAudio(options: { state?: AudioContextState } = {}) {
  const tones: Tone[] = [];
  const created = vi.fn();
  const resume = vi.fn(async () => undefined);
  class FakeAudioContext {
    state: AudioContextState = options.state ?? 'running';
    currentTime = 0;
    destination = {};
    constructor() {
      created();
    }
    resume = resume;
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    createOscillator() {
      const tone: Tone = { frequency: 0, type: '', started: null, stopped: null };
      tones.push(tone);
      return {
        set type(value: string) {
          tone.type = value;
        },
        frequency: {
          set value(v: number) {
            tone.frequency = v;
          },
          setValueAtTime(v: number) {
            tone.frequency = v;
          },
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        start(at: number) {
          tone.started = at;
        },
        stop(at: number) {
          tone.stopped = at;
        },
      };
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { tones, created, resume };
}

beforeEach(() => resetSoundsForTests());
afterEach(() => vi.unstubAllGlobals());

describe('answer sounds', () => {
  it('plays two rising notes for a right answer', () => {
    const { tones } = stubAudio();
    playCorrect();
    expect(tones).toHaveLength(2);
    expect(tones[1].frequency).toBeGreaterThan(tones[0].frequency);
    expect(tones.every((t) => t.started !== null && t.stopped !== null && t.stopped > t.started!)).toBe(true);
    expect(tones[1].started!).toBeGreaterThan(tones[0].started!);
  });

  it('plays one low, short note for a wrong answer, lower than the right-answer notes', () => {
    const right = stubAudio();
    playCorrect();
    const lowestRight = Math.min(...right.tones.map((t) => t.frequency));
    vi.unstubAllGlobals();
    resetSoundsForTests();
    const wrong = stubAudio();
    playWrong();
    expect(wrong.tones).toHaveLength(1);
    expect(wrong.tones[0].frequency).toBeLessThan(lowestRight);
    expect(wrong.tones[0].stopped! - wrong.tones[0].started!).toBeLessThan(0.5);
  });

  it('keeps the sounds quiet and short', () => {
    const { tones } = stubAudio();
    playCorrect();
    playWrong();
    for (const t of tones) expect(t.stopped! - t.started!).toBeLessThan(0.5);
  });

  it('creates the audio context once and reuses it', () => {
    const { created } = stubAudio();
    playCorrect();
    playWrong();
    playCorrect();
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('wakes a suspended audio context before playing', () => {
    const { resume } = stubAudio({ state: 'suspended' });
    playCorrect();
    expect(resume).toHaveBeenCalled();
  });

  it('does nothing, without an error, when the browser has no Web Audio', () => {
    expect(() => playCorrect()).not.toThrow();
    expect(() => playWrong()).not.toThrow();
  });

  it('never throws when the audio API fails', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    expect(() => playCorrect()).not.toThrow();
    expect(() => playWrong()).not.toThrow();
  });
});
