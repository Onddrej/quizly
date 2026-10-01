import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSpeech } from './useSpeech';

const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice;
class FakeUtterance { text: string; lang = ''; rate = 1; voice: SpeechSynthesisVoice | null = null; constructor(t: string) { this.text = t; } }
function stub(initial: SpeechSynthesisVoice[]) {
  let voices = initial;
  const listeners = new Set<() => void>();
  const synth = {
    speak: vi.fn(), cancel: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((_: string, l: () => void) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: () => void) => listeners.delete(l)),
  };
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, listeners, setVoices(v: SpeechSynthesisVoice[]) { voices = v; listeners.forEach((l) => l()); } };
}
afterEach(() => vi.unstubAllGlobals());

describe('useSpeech', () => {
  it('unsupported: not available, stable', () => {
    let renders = 0;
    const { result } = renderHook(() => { renders++; return useSpeech(); });
    expect(result.current).toMatchObject({ supported: false, available: false, voicesLoaded: false, hasEnglish: false });
  });
  it('shows buttons while voices load, then reacts to voiceschanged', () => {
    const s = stub([]);
    const { result } = renderHook(() => useSpeech());
    expect(result.current).toMatchObject({ supported: true, available: true, voicesLoaded: false });
    act(() => s.setVoices([voice('sk-SK')]));
    expect(result.current).toMatchObject({ available: false, voicesLoaded: true, hasEnglish: false });
    act(() => s.setVoices([voice('sk-SK'), voice('en-GB')]));
    expect(result.current).toMatchObject({ available: true, hasEnglish: true });
  });
  it('unsubscribes the same listener on unmount, one listener per instance', () => {
    const s = stub([voice('en-US')]);
    const a = renderHook(() => useSpeech());
    const b = renderHook(() => useSpeech());
    expect(s.listeners.size).toBe(2);
    a.unmount(); expect(s.listeners.size).toBe(1);
    b.unmount(); expect(s.listeners.size).toBe(0);
  });
  it('say is stable across re-renders and speaks', () => {
    const s = stub([voice('en-US')]);
    const { result, rerender } = renderHook(() => useSpeech());
    const first = result.current.say;
    rerender();
    expect(result.current.say).toBe(first);
    result.current.say('hi');
    expect(s.synth.speak).toHaveBeenCalledTimes(1);
  });
  it('getVoices call count on mount (lazy init + effect)', () => {
    const s = stub([voice('en-US')]);
    renderHook(() => useSpeech());
    expect(s.synth.getVoices).toHaveBeenCalled();
  });
});
