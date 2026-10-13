import { Button } from '../../ui/Button';
import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

interface PromptCardProps {
  label: string;
  word: string;
  lang: string;
  /** English text the speaker reads (the term). */
  speak?: string;
  /** Written questions: "Don't know?" sits in this header, above the answer field, so a phone keyboard never covers it. */
  onDontKnow?: () => void;
  locked?: boolean;
}

/** The card with the question: label row ("Don't know?", speaker) and the word. The answer's details are never shown here. */
export function PromptCard({ label, word, lang, speak, onDontKnow, locked = false }: PromptCardProps) {
  return (
    <div className={`card ${styles.prompt}`}>
      <div className={styles.promptLabel}>
        <span>{label}</span>
        <span className={styles.tools}>
          {onDontKnow && (
            <Button variant="ghost" className={styles.dontKnow} onClick={onDontKnow} disabled={locked}>
              Don't know?
            </Button>
          )}
          {speak && <SpeakButton text={speak} />}
        </span>
      </div>
      <p className={styles.word} lang={lang}>
        {word}
      </p>
    </div>
  );
}
