import type { Accent } from '../db/types';
import { diagnostics } from './diagnostics';

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

/** How long a started utterance may stay silent before it counts as failed. */
const START_TIMEOUT_MS = 3000;

const describeVoice = (voice: SpeechSynthesisVoice | undefined) =>
  voice ? `${voice.name} (${voice.lang}, ${voice.localService ? 'on-device' : 'network'})` : 'default voice';

export function speak(text: string, accent: Accent): void {
  if (!isSpeechSupported() || !text.trim()) return;
  // Callers include a React effect (flashcard autoplay): an exception from the speech API must never reach React and
  // replace the page with the error screen. Failing to speak is silent.
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    utter(synth, text, accent, pickVoice(synth.getVoices(), accent), true);
  } catch {
    // speech is a convenience; nothing to recover
  }
}

/**
 * Speaks once. Some Android engines fail or stay silent for the voice the browser lists (the voice list says "English"
 * while the engine has no data for it): the failure goes to the diagnostics log, and the first failure of a chosen voice
 * is retried with the engine's own default voice for the accent.
 */
function utter(synth: SpeechSynthesis, text: string, accent: Accent, voice: SpeechSynthesisVoice | undefined, mayRetry: boolean): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = 0.95;
  if (voice) utterance.voice = voice;
  let started = false;
  let done = false;
  const fail = (reason: string) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    diagnostics.record({ kind: 'speech', message: `${reason}; ${describeVoice(voice)}` });
    if (!started && voice && mayRetry) {
      try {
        synth.cancel();
        utter(synth, text, accent, undefined, false);
      } catch {
        // nothing more to try
      }
    }
  };
  const timer = setTimeout(() => fail(`did not start within ${START_TIMEOUT_MS / 1000} s`), START_TIMEOUT_MS);
  utterance.onstart = () => {
    started = true;
    clearTimeout(timer);
  };
  utterance.onend = () => {
    done = true;
    clearTimeout(timer);
  };
  utterance.onerror = (event) => {
    // the next utterance cancels the current one: that is not a failure
    if (event.error === 'interrupted' || event.error === 'canceled') {
      done = true;
      clearTimeout(timer);
    } else fail(event.error);
  };
  synth.speak(utterance);
}
