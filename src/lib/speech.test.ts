import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVoices, hasEnglishVoice, isSpeechSupported, onVoicesChanged, pickVoice, speak } from './speech';

const voice = (lang: string, name = lang, localService?: boolean) => ({ lang, name, localService }) as SpeechSynthesisVoice;

class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
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

afterEach(() => {
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
