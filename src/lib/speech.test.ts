import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { diagnostics } from './diagnostics';
import { getSpeechFailed, getVoices, hasEnglishVoice, isSpeechSupported, onSpeechFailedChanged, onVoicesChanged, pickVoice, resetSpeechForTests, speak } from './speech';

const voice = (lang: string, name = lang, localService?: boolean) => ({ lang, name, localService }) as SpeechSynthesisVoice;

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function stubSpeech(voices: SpeechSynthesisVoice[]) {
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return synth;
}

beforeEach(() => {
  diagnostics.clear();
  resetSpeechForTests();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pickVoice', () => {
  it('prefers the exact accent, including Android-style underscores', () => {
    expect(pickVoice([voice('en-US'), voice('en-GB')], 'en-GB')?.lang).toBe('en-GB');
    expect(pickVoice([voice('en_US', 'android'), voice('en-GB')], 'en-US')?.name).toBe('android');
  });
  it('falls back to any English voice, otherwise undefined', () => {
    expect(pickVoice([voice('sk-SK'), voice('en-AU')], 'en-GB')?.lang).toBe('en-AU');
    expect(pickVoice([voice('sk-SK')], 'en-US')).toBeUndefined();
  });
  it('matches an Android underscore voice exactly, not just by English fallback', () => {
    expect(pickVoice([voice('en-GB', 'gb'), voice('en_US', 'us')], 'en-US')?.name).toBe('us');
  });
  it('is case-insensitive on the voice side too', () => {
    expect(pickVoice([voice('EN-gb', 'gb'), voice('en-US')], 'en-GB')?.name).toBe('gb');
  });

  describe('on-device ranking (network voices are silent offline)', () => {
    it('prefers a local voice over a network voice for the same accent', () => {
      const voices = [voice('en-US', 'network', false), voice('en-US', 'local', true)];
      expect(pickVoice(voices, 'en-US')?.name).toBe('local');
    });
    it('lets an accent match beat locality', () => {
      const voices = [voice('en-US', 'us-network', false), voice('en-GB', 'gb-local', true)];
      expect(pickVoice(voices, 'en-US')?.name).toBe('us-network');
    });
    it('prefers a local voice among the English fallbacks when no accent matches', () => {
      const voices = [voice('en-AU', 'au-network', false), voice('en-AU', 'au-local', true)];
      expect(pickVoice(voices, 'en-GB')?.name).toBe('au-local');
    });
    it('treats a missing localService flag as not local', () => {
      const voices = [voice('en-US', 'unknown'), voice('en-US', 'local', true)];
      expect(pickVoice(voices, 'en-US')?.name).toBe('local');
    });
    it('keeps the first voice in the device list when ranks are equal', () => {
      expect(pickVoice([voice('en-US', 'first', true), voice('en-US', 'second', true)], 'en-US')?.name).toBe('first');
      expect(pickVoice([voice('en-US', 'first', false), voice('en-US', 'second', false)], 'en-US')?.name).toBe('first');
      expect(pickVoice([voice('en-AU', 'first', true), voice('en-IN', 'second', true)], 'en-GB')?.name).toBe('first');
    });
    it('still handles underscore languages and returns undefined without an English voice', () => {
      expect(pickVoice([voice('en_US', 'underscore', false), voice('en-GB', 'gb', true)], 'en-US')?.name).toBe('underscore');
      expect(pickVoice([voice('sk-SK', 'sk', true), voice('de-DE', 'de', true)], 'en-US')).toBeUndefined();
    });
  });
});

describe('hasEnglishVoice', () => {
  it('detects English voices', () => {
    expect(hasEnglishVoice([voice('sk-SK'), voice('en-IN')])).toBe(true);
    expect(hasEnglishVoice([voice('sk-SK')])).toBe(false);
  });
  it('does not treat non-English voices starting with e as English', () => {
    expect(hasEnglishVoice([voice('es-ES'), voice('et-EE')])).toBe(false);
    expect(pickVoice([voice('es-ES')], 'en-US')).toBeUndefined();
  });
});

describe('speak', () => {
  it('reports no support in plain jsdom', () => {
    expect(isSpeechSupported()).toBe(false);
  });

  it('cancels current speech and speaks with the chosen accent and voice', () => {
    const synth = stubSpeech([voice('en-US'), voice('en-GB')]);
    speak('boarding pass', 'en-GB');
    expect(synth.cancel).toHaveBeenCalled();
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe('boarding pass');
    expect(utterance.lang).toBe('en-GB');
    expect(utterance.voice?.lang).toBe('en-GB');
    expect(utterance.rate).toBe(0.95);
  });

  it('ignores blank text', () => {
    const synth = stubSpeech([voice('en-US')]);
    speak('   ', 'en-US');
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('cancels BEFORE it speaks (otherwise the new utterance is killed)', () => {
    const synth = stubSpeech([voice('en-US')]);
    speak('hello', 'en-US');
    expect(synth.cancel.mock.invocationCallOrder[0]).toBeLessThan(synth.speak.mock.invocationCallOrder[0]);
  });

  it('still speaks with the accent as lang when the device has no English voice', () => {
    const synth = stubSpeech([voice('sk-SK')]);
    speak('hello', 'en-GB');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.lang).toBe('en-GB');
    expect(utterance.voice).toBeNull();
  });

  it('never throws when the speech API does', () => {
    const synth = stubSpeech([voice('en-US')]);
    synth.speak.mockImplementation(() => {
      throw new Error('synthesis-failed');
    });
    expect(() => speak('hello', 'en-US')).not.toThrow();
    synth.cancel.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => speak('hello', 'en-US')).not.toThrow();
    synth.getVoices.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => speak('hello', 'en-US')).not.toThrow();
  });

  it('does not cancel current speech when the text is blank', () => {
    const synth = stubSpeech([voice('en-US')]);
    speak('  ', 'en-US');
    expect(synth.cancel).not.toHaveBeenCalled();
  });

  it('needs both speechSynthesis and SpeechSynthesisUtterance', () => {
    vi.stubGlobal('speechSynthesis', { getVoices: () => [] });
    expect(isSpeechSupported()).toBe(false);
  });
});

describe('getVoices', () => {
  it('returns an empty list when speech is unsupported', () => {
    expect(getVoices()).toEqual([]);
  });

  it('returns the voices the device offers when speech is supported', () => {
    const voices = [voice('en-US'), voice('sk-SK')];
    stubSpeech(voices);
    expect(getVoices()).toEqual(voices);
  });
});

describe('onVoicesChanged', () => {
  it('returns a harmless unsubscribe function when speech is unsupported', () => {
    const listener = vi.fn();
    const unsubscribe = onVoicesChanged(listener);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('registers the listener for the voiceschanged event', () => {
    const synth = stubSpeech([voice('en-US')]);
    const listener = vi.fn();
    onVoicesChanged(listener);
    expect(synth.addEventListener).toHaveBeenCalledTimes(1);
    expect(synth.addEventListener).toHaveBeenCalledWith('voiceschanged', listener);
  });

  it('removes the very same listener when the returned function is called', () => {
    const synth = stubSpeech([voice('en-US')]);
    const listener = vi.fn();
    const unsubscribe = onVoicesChanged(listener);
    expect(synth.removeEventListener).not.toHaveBeenCalled();
    unsubscribe();
    expect(synth.removeEventListener).toHaveBeenCalledTimes(1);
    expect(synth.removeEventListener).toHaveBeenCalledWith('voiceschanged', listener);
  });
});

describe('speak: when the device stays silent', () => {
  const lastUtterance = (synth: ReturnType<typeof stubSpeech>) => synth.speak.mock.calls.at(-1)?.[0] as FakeUtterance;
  const failures = () => diagnostics.entries().filter((e) => e.kind === 'speech');

  it('writes the error of a failed utterance to the diagnostics log, with the voice that was used', () => {
    const synth = stubSpeech([voice('en-US', 'Google US English', true)]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(failures()).toHaveLength(1);
    expect(failures()[0].message).toBe('synthesis-failed; Google US English (en-US, on-device)');
  });

  it('does not log the normal interruption by the next utterance', () => {
    const synth = stubSpeech([voice('en-US')]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'interrupted' });
    lastUtterance(synth).onerror?.({ error: 'canceled' });
    expect(failures()).toEqual([]);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('tries once more without the chosen voice when that voice fails', () => {
    const synth = stubSpeech([voice('en-US', 'broken', true)]);
    speak('hello', 'en-GB');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    const retry = lastUtterance(synth);
    expect(retry.text).toBe('hello');
    expect(retry.lang).toBe('en-GB');
    expect(retry.voice).toBeNull();
    retry.onerror?.({ error: 'synthesis-failed' });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(failures().map((e) => e.message)).toEqual(['synthesis-failed; broken (en-US, on-device)', 'synthesis-failed; default voice']);
  });

  it('does not retry when no voice was chosen, or when the failure comes after the speech had started', () => {
    const none = stubSpeech([voice('sk-SK')]);
    speak('hello', 'en-US');
    lastUtterance(none).onerror?.({ error: 'synthesis-failed' });
    expect(none.speak).toHaveBeenCalledTimes(1);

    const started = stubSpeech([voice('en-US')]);
    speak('hello', 'en-US');
    lastUtterance(started).onstart?.();
    lastUtterance(started).onerror?.({ error: 'audio-busy' });
    expect(started.speak).toHaveBeenCalledTimes(1);
  });

  it('logs it, and tries the default voice, when nothing starts within three seconds', () => {
    vi.useFakeTimers();
    const synth = stubSpeech([voice('en-US', 'quiet', true)]);
    speak('hello', 'en-US');
    vi.advanceTimersByTime(2999);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(failures().map((e) => e.message)).toEqual(['did not start within 3 s; quiet (en-US, on-device)']);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(lastUtterance(synth).voice).toBeNull();
  });

  it('stays quiet when the speech starts in time', () => {
    vi.useFakeTimers();
    const synth = stubSpeech([voice('en-US')]);
    speak('hello', 'en-US');
    lastUtterance(synth).onstart?.();
    vi.advanceTimersByTime(10000);
    expect(failures()).toEqual([]);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('forgets the pending check when the next utterance interrupts the first', () => {
    vi.useFakeTimers();
    const synth = stubSpeech([voice('en-US')]);
    speak('one', 'en-US');
    const first = lastUtterance(synth);
    speak('two', 'en-US');
    first.onerror?.({ error: 'interrupted' });
    lastUtterance(synth).onstart?.();
    vi.advanceTimersByTime(10000);
    expect(failures()).toEqual([]);
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });
});

describe('speak: engine failure state (the speech engine of the phone is stuck)', () => {
  const lastUtterance = (synth: ReturnType<typeof stubSpeech>) => synth.speak.mock.calls.at(-1)?.[0] as FakeUtterance;

  it('is not failed before anything went wrong', () => {
    stubSpeech([voice('en-US')]);
    expect(getSpeechFailed()).toBe(false);
    speak('hello', 'en-US');
    expect(getSpeechFailed()).toBe(false);
  });

  it('is not failed while the retry with the default voice is still pending', () => {
    const synth = stubSpeech([voice('en-US', 'broken', true)]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(getSpeechFailed()).toBe(false);
  });

  it('is failed once the retry fails too, and cleared as soon as speech starts again', () => {
    const synth = stubSpeech([voice('en-US', 'broken', true)]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(getSpeechFailed()).toBe(true);

    speak('again', 'en-US');
    expect(getSpeechFailed()).toBe(true); // still unproven until the engine actually starts
    lastUtterance(synth).onstart?.();
    expect(getSpeechFailed()).toBe(false);
  });

  it('is cleared by the retry when the default voice works', () => {
    const synth = stubSpeech([voice('en-US', 'broken', true)]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    lastUtterance(synth).onstart?.();
    expect(getSpeechFailed()).toBe(false);
  });

  it('is failed straight away when no voice was chosen and the engine refuses', () => {
    const synth = stubSpeech([voice('sk-SK')]);
    speak('hello', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(getSpeechFailed()).toBe(true);
  });

  it('is failed when the engine stays silent for the chosen voice and for the default voice', () => {
    vi.useFakeTimers();
    stubSpeech([voice('en-US', 'quiet', true)]);
    speak('hello', 'en-US');
    vi.advanceTimersByTime(3000);
    expect(getSpeechFailed()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(getSpeechFailed()).toBe(true);
  });

  it('is failed when the retry itself cannot be started', () => {
    const synth = stubSpeech([voice('en-US', 'broken', true)]);
    speak('hello', 'en-US');
    synth.speak.mockImplementation(() => {
      throw new Error('boom');
    });
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(getSpeechFailed()).toBe(true);
  });

  it('does not count the normal interruption, nor an error after the speech had started', () => {
    const synth = stubSpeech([voice('en-US')]);
    speak('one', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'interrupted' });
    expect(getSpeechFailed()).toBe(false);
    speak('two', 'en-US');
    lastUtterance(synth).onstart?.();
    lastUtterance(synth).onerror?.({ error: 'audio-busy' });
    expect(getSpeechFailed()).toBe(false);
  });

  it('tells listeners only when the state changes, and stops after unsubscribe', () => {
    const synth = stubSpeech([voice('sk-SK')]);
    const listener = vi.fn();
    const unsubscribe = onSpeechFailedChanged(listener);
    speak('one', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    speak('two', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(listener).toHaveBeenCalledTimes(1);
    speak('three', 'en-US');
    lastUtterance(synth).onstart?.();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    speak('four', 'en-US');
    lastUtterance(synth).onerror?.({ error: 'synthesis-failed' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
