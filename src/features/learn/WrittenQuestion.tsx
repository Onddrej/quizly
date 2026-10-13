import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { PromptCard } from './PromptCard';
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
      <PromptCard label={label} word={prompt} lang={promptLang} speak={speak} onDontKnow={onDontKnow} locked={locked} />
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
        {/* The button shares the row with the field: Chrome's autofill bar on top of the keyboard would cover a button below it. */}
        <div className={styles.inputRow}>
          <input
            id="answer-input"
            ref={input}
            value={value}
            disabled={locked}
            placeholder="Type the answer"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="go"
            spellCheck={false}
            className={`${styles.input} ${resultClass}`}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button type="submit" disabled={locked}>
            Answer
          </Button>
        </div>
      </form>
    </>
  );
}
