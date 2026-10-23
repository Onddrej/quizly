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
  /** A wrong answer is being retyped: only the question is shown, the retype card below has the one field. */
  retype?: boolean;
  result: 'ok' | 'no' | null;
  onSubmit: (answer: string) => void;
  onDontKnow: () => void;
}

export function WrittenQuestion({ label, prompt, promptLang, speak, instruction, locked, retype = false, result, onSubmit, onDontKnow }: WrittenQuestionProps) {
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // A new typed question starts at the top of the page body: the previous screen (a tall retype card) left it scrolled
  // down, which would show the field with the question above it out of sight. Focus without scrolling, so the browser
  // does not move the page again.
  useEffect(() => {
    input.current?.closest('main')?.scrollTo?.({ top: 0 });
    input.current?.focus({ preventScroll: true });
  }, []);

  const resultClass = result === 'ok' ? styles.inputOk : result === 'no' ? styles.inputNo : '';
  return (
    <>
      <PromptCard label={label} word={prompt} lang={promptLang} speak={speak} />
      {!retype && (
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
          {/* type=search: Chrome on Android shows its autofill strip (passwords, payments, addresses) above the keyboard for
              type=text fields however they are configured, but not for search fields (tested on a phone). */}
          <input
            id="answer-input"
            ref={input}
            type="search"
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
          {!locked && (
            <div className={styles.answerActions}>
              <Button variant="ghost" onClick={onDontKnow}>
                Don't know?
              </Button>
              <Button type="submit">Answer</Button>
            </div>
          )}
        </form>
      )}
    </>
  );
}
