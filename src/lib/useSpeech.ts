import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSettings } from '../app/SettingsContext';
import { getSpeechFailed, getVoices, hasEnglishVoice, isSpeechSupported, onSpeechFailedChanged, onVoicesChanged, speak } from './speech';

export interface SpeechState {
  supported: boolean;
  /** Show speaker buttons: supported, and either voices are still loading or an English voice exists. */
  available: boolean;
  voicesLoaded: boolean;
  hasEnglish: boolean;
  /** The device's speech engine refused the last attempt, with the chosen voice and the default one (it is stuck). */
  failed: boolean;
  say: (text: string) => void;
}

export function useSpeech(): SpeechState {
  const { accent } = useSettings();
  const supported = isSpeechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(getVoices);
  const failed = useSyncExternalStore(onSpeechFailedChanged, getSpeechFailed);

  useEffect(() => {
    const update = () => setVoices(getVoices());
    update();
    return onVoicesChanged(update);
  }, []);

  const say = useCallback((text: string) => speak(text, accent), [accent]);
  const hasEnglish = hasEnglishVoice(voices);
  return {
    supported,
    available: supported && (voices.length === 0 || hasEnglish),
    voicesLoaded: voices.length > 0,
    hasEnglish,
    failed,
    say,
  };
}
