import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { Button } from '../../ui/Button';
import { CardBack } from '../../ui/CardBack';
import { IconButton } from '../../ui/IconButton';
import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

/** What a hint may show: the English definition and the example sentences (one per line). The term is already blanked when it is the answer. */
export interface HintContent {
  meaning?: string;
  examples?: string;
}

interface PromptCardProps {
  label: string;
  word: string;
  lang: string;
  /** English text the speaker reads (the term). */
  speak?: string;
  hint: HintContent | null;
  /** Written questions: "Don't know?" sits in this header, above the answer field, so a phone keyboard never covers it. */
  onDontKnow?: () => void;
  locked?: boolean;
}

/** The card with the question: label row (hint, "Don't know?", speaker), the word, and the hint when it is open. */
export function PromptCard({ label, word, lang, speak, hint, onDontKnow, locked = false }: PromptCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`card ${styles.prompt}`}>
      <div className={styles.promptLabel}>
        <span>{label}</span>
        <span className={styles.tools}>
          {hint && (
            <IconButton
              label={open ? 'Hide hint' : 'Show hint'}
              aria-expanded={open}
              tone={open ? 'accent' : 'default'}
              icon={<Lightbulb size={20} />}
              onClick={() => setOpen((o) => !o)}
            />
          )}
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
      {hint && open && (
        <div role="group" aria-label="Hint" className={styles.hint}>
          <CardBack card={{ definition: '', meaning: hint.meaning, examples: hint.examples }} showTranslation={false} />
        </div>
      )}
    </div>
  );
}
