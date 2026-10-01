import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../app/SettingsContext';
import { hasEnglishVoice, isSpeechSupported, speak } from './speech';

export interface SpeechState {
  supported: boolean;
  /** Show speaker buttons: supported, and either voices are still loading or an English voice exists. */
  available: boolean;
  voicesLoaded: boolean;
  hasEnglish: boolean;
  say: (text: string) => void;
}

export function useSpeech(): SpeechState {
  const { accent } = useSettings();
  const supported = isSpeechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => (supported ? window.speechSynthesis.getVoices() : []));

  useEffect(() => {
    if (!isSpeechSupported()) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);

  const say = useCallback((text: string) => speak(text, accent), [accent]);
  const hasEnglish = hasEnglishVoice(voices);
  return {
    supported,
    available: supported && (voices.length === 0 || hasEnglish),
    voicesLoaded: voices.length > 0,
    hasEnglish,
    say,
  };
}
