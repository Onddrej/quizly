import type { Accent } from '../db/types';

const langOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export function hasEnglishVoice(voices: readonly SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => langOf(v).startsWith('en'));
}

export function pickVoice(voices: readonly SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | undefined {
  const wanted = accent.toLowerCase();
  return voices.find((v) => langOf(v) === wanted) ?? voices.find((v) => langOf(v).startsWith('en'));
}

export function speak(text: string, accent: Accent): void {
  if (!isSpeechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent;
  utterance.rate = 0.95;
  const voice = pickVoice(synth.getVoices(), accent);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}
