import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

interface PromptCardProps {
  label: string;
  word: string;
  lang: string;
  /** English text the speaker reads (the term). */
  speak?: string;
}

/** The card with the question: label row (with the speaker) and the word. The answer's details are never shown here. */
export function PromptCard({ label, word, lang, speak }: PromptCardProps) {
  return (
    <div className={`card ${styles.prompt}`}>
      <div className={styles.promptLabel}>
        <span>{label}</span>
        {speak && <SpeakButton text={speak} />}
      </div>
      <p className={styles.word} lang={lang}>
        {word}
      </p>
    </div>
  );
}
