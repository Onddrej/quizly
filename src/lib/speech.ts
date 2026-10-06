import type { Accent } from '../db/types';

const langOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Voices the device offers; empty when speech is unsupported or the list has not loaded yet. */
export function getVoices(): SpeechSynthesisVoice[] {
  return isSpeechSupported() ? window.speechSynthesis.getVoices() : [];
}

/** Calls `listener` whenever the voice list changes (it loads asynchronously). Returns an unsubscribe function; a no-op when unsupported. */
export function onVoicesChanged(listener: () => void): () => void {
  if (!isSpeechSupported()) return () => undefined;
  const synth = window.speechSynthesis;
  synth.addEventListener('voiceschanged', listener);
  return () => synth.removeEventListener('voiceschanged', listener);
}

export function hasEnglishVoice(voices: readonly SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => langOf(v).startsWith('en'));
}

/** Best English voice: exact accent beats any English, and on-device (`localService === true`) beats network (undefined/false) since network voices are silent offline; the first of equals wins. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | undefined {
  const wanted = accent.toLowerCase();
  const rank = (v: SpeechSynthesisVoice): number => {
    const lang = langOf(v);
    const local = v.localService === true ? 1 : 0;
    if (lang === wanted) return 2 + local;
    if (lang.startsWith('en')) return local;
    return -1;
  };
  let best: SpeechSynthesisVoice | undefined;
  let bestRank = -1;
  for (const v of voices) {
    const r = rank(v);
    if (r > bestRank) {
      best = v;
      bestRank = r;
    }
  }
  return best;
}

export function speak(text: string, accent: Accent): void {
  if (!isSpeechSupported() || !text.trim()) return;
  // Callers include a React effect (flashcard autoplay): an exception from the speech API must never reach React and
  // replace the page with the error screen. Failing to speak is silent.
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = accent;
    utterance.rate = 0.95;
    const voice = pickVoice(synth.getVoices(), accent);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  } catch {
    // speech is a convenience; nothing to recover
  }
}
