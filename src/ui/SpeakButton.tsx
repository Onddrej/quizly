import { Volume2 } from 'lucide-react';
import { useSpeech } from '../lib/useSpeech';
import { IconButton } from './IconButton';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Speaker for an English term. Hidden when the device cannot speak English. */
export function SpeakButton({ text, size = 'md' }: { text: string; size?: 'md' | 'sm' }) {
  const { available, say } = useSpeech();
  if (!available) return null;
  return (
    <IconButton
      label={`Play pronunciation: ${text}`}
      tone="accent"
      size={size}
      icon={<Volume2 size={size === 'sm' ? 18 : 20} />}
      onPointerDown={stop}
      onPointerUp={stop}
      onClick={(e) => {
        e.stopPropagation();
        say(text);
      }}
    />
  );
}
