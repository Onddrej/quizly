import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

interface WrittenQuestionProps {
  label: 'Translation' | 'Term';
  prompt: string;
  promptLang: string;
  speak?: string;
  instruction: string;
  locked: boolean;
  result: 'ok' | 'no' | null;
  onSubmit: (answer: string) => void;
  onDontKnow: () => void;
}

export function WrittenQuestion({ label, prompt, promptLang, speak, instruction, locked, result, onSubmit, onDontKnow }: WrittenQuestionProps) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const resultClass = result === 'ok' ? styles.inputOk : result === 'no' ? styles.inputNo : '';
  return (
    <>
      <div className={`card ${styles.prompt}`}>
        <div className={styles.promptLabel}>
          <span>{label}</span>
          {speak && <SpeakButton text={speak} />}
        </div>
        <p className={styles.word} lang={promptLang}>
          {prompt}
        </p>
      </div>
      <form
        className={styles.answer}
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) {
            input.current?.focus();
            return;
          }
          onSubmit(value);
        }}
      >
        <label htmlFor="answer-input" className={styles.ask}>
          {instruction}
        </label>
        <input
          id="answer-input"
          ref={input}
          value={value}
          disabled={locked}
          placeholder="Type the answer"
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="go"
          spellCheck={false}
          className={`${styles.input} ${resultClass}`}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className={styles.answerActions}>
          <Button variant="ghost" onClick={onDontKnow} disabled={locked}>
            Don't know?
          </Button>
          <Button type="submit" disabled={locked}>
            Answer
          </Button>
        </div>
      </form>
    </>
  );
}
