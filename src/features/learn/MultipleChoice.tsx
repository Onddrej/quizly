import { useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';
import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

interface MultipleChoiceProps {
  term: string;
  choices: string[];
  correct: string;
  locked: boolean;
  onPick: (choice: string) => void;
}

export function MultipleChoice({ term, choices, correct, locked, onPick }: MultipleChoiceProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());

  // The feedback panel appears below and takes room from the options: on short phones keep the picked option and the
  // correct one (with their marks) in view. Not every environment has scrollIntoView (jsdom does not).
  useEffect(() => {
    if (picked === null) return;
    optionRefs.current.get(picked)?.scrollIntoView?.({ block: 'nearest' });
    optionRefs.current.get(correct)?.scrollIntoView?.({ block: 'nearest' });
  }, [picked, correct]);

  return (
    <>
      <div className={`card ${styles.prompt}`}>
        <div className={styles.promptLabel}>
          <span>Term</span>
          <SpeakButton text={term} />
        </div>
        <p className={styles.word} lang="en">
          {term}
        </p>
      </div>
      <p className={styles.ask} id="choice-question">
        Choose the matching translation
      </p>
      <div className={styles.options} role="group" aria-labelledby="choice-question">
        {choices.map((choice) => {
          const state = picked === null ? '' : choice === correct ? styles.correct : choice === picked ? styles.wrong : styles.dim;
          return (
            <button
              key={choice}
              ref={(el) => {
                if (el) optionRefs.current.set(choice, el);
                else optionRefs.current.delete(choice);
              }}
              type="button"
              className={`${styles.option} ${state}`}
              disabled={locked || picked !== null}
              onClick={() => {
                setPicked(choice);
                onPick(choice);
              }}
            >
              <span>{choice}</span>
              {picked !== null && choice === correct && (
                <>
                  <CircleCheck size={20} className={styles.okIcon} />
                  <span className="visually-hidden">Correct answer</span>
                </>
              )}
              {picked === choice && choice !== correct && (
                <>
                  <CircleX size={20} className={styles.noIcon} />
                  <span className="visually-hidden">Your answer</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
