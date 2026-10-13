import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { SpeakButton } from '../../ui/SpeakButton';
import { checkAnswer, type AnswerLanguage } from './answerCheck';
import styles from './Learn.module.css';

interface CopyAnswerProps {
  title: string;
  /** The explanation that names the correct answer (with the "again this round" note). */
  children: ReactNode;
  /** The answer that has to be typed. */
  expected: string;
  language: AnswerLanguage;
  /** English text the speaker reads (the term). */
  speak?: string;
  /** What was typed (a wrong answer), shown so it can be compared with the correct one; absent after "Don't know?". */
  written?: string;
  /** Definition and examples of the card, shown while the answer is being copied. */
  details?: ReactNode;
  onMatch: () => void;
  onOverrule?: () => void;
}

/**
 * After a missed typed answer: the correct answer stays on screen and has to be typed before the round moves on, as in
 * Quizlet. It sits in the page body, not the bottom panel, because a phone keyboard would cover the panel. Only an exact
 * copy counts (a typo is not accepted: the text is right there), and any one comma-separated variant is enough.
 *
 * Everything the user may need to press is at or above the field: Chrome puts an autofill bar between the field and the
 * keyboard, and it covers whatever sits below the field.
 */
export function CopyAnswer({ title, children, expected, language, speak, written, details, onMatch, onOverrule }: CopyAnswerProps) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  return (
    <section aria-label="Correct answer" className={`card ${styles.copy} ${styles.no}`}>
      <div className={styles.msg}>
        <span className={styles.icon}>
          <X size={20} />
        </span>
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <div className={styles.sub}>{children}</div>
        </div>
        {speak && <SpeakButton text={speak} />}
      </div>
      {written && (
        <p className={styles.picked}>
          <X size={16} aria-hidden="true" />
          <span>You wrote {written}</span>
        </p>
      )}
      {details}
      {onOverrule && (
        <Button variant="ghost" className={styles.overrule} onClick={onOverrule}>
          I was right
        </Button>
      )}
      <form
        className={styles.answer}
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (checkAnswer(value, expected, language) === 'exact') {
            onMatch();
            return;
          }
          setWrong(true);
          input.current?.focus();
        }}
      >
        <label htmlFor="copy-input" className={styles.ask}>
          Type the answer to continue
        </label>
        {wrong && (
          <p id="copy-error" role="alert" className={styles.copyError}>
            Not quite. Type the answer exactly as shown.
          </p>
        )}
        <div className={styles.inputRow}>
          <input
            id="copy-input"
            ref={input}
            value={value}
            placeholder="Type the answer"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
            spellCheck={false}
            aria-invalid={wrong || undefined}
            aria-describedby={wrong ? 'copy-error' : undefined}
            className={`${styles.input} ${wrong ? styles.inputNo : ''}`}
            onChange={(e) => {
              setValue(e.target.value);
              setWrong(false);
            }}
          />
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </section>
  );
}
