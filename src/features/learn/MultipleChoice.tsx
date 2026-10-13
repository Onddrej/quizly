import { useState } from 'react';
import { PromptCard } from './PromptCard';
import styles from './Learn.module.css';

interface MultipleChoiceProps {
  term: string;
  choices: string[];
  locked: boolean;
  onPick: (choice: string) => void;
}

/** The question only: after a pick the page swaps this for the answer card, so no right/wrong marks are drawn here. */
export function MultipleChoice({ term, choices, locked, onPick }: MultipleChoiceProps) {
  const [picked, setPicked] = useState(false);

  return (
    <>
      <PromptCard label="Term" word={term} lang="en" speak={term} />
      <p className={styles.ask} id="choice-question">
        Choose the matching translation
      </p>
      <div className={styles.options} role="group" aria-labelledby="choice-question">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={styles.option}
            disabled={locked || picked}
            onClick={() => {
              setPicked(true);
              onPick(choice);
            }}
          >
            <span>{choice}</span>
          </button>
        ))}
      </div>
    </>
  );
}
