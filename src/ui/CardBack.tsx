import type { Card } from '../db/types';
import { splitExamples } from '../lib/cardDetails';
import styles from './CardBack.module.css';

interface CardBackProps {
  card: Pick<Card, 'definition' | 'meaning' | 'examples'>;
  /** BCP 47 language of the translation (the set's definition language). */
  lang?: string;
  /** `row` for list rows, `face` for the large centered flashcard side. */
  variant?: 'row' | 'face';
  /** Set to false where the translation is already on screen and only the definition and examples are wanted. */
  showTranslation?: boolean;
}

/**
 * The answer side of a card: the translation (bold), the optional English
 * definition and the optional example sentences (italic, one per line).
 * Blank or missing parts render nothing, so they never leave a gap.
 */
export function CardBack({ card, lang, variant = 'row', showTranslation = true }: CardBackProps) {
  const meaning = card.meaning?.trim();
  const examples = splitExamples(card.examples);

  return (
    <div className={`${styles.wrap} ${styles[variant]}`}>
      {showTranslation && (
        <p className={styles.translation} lang={lang}>
          {card.definition}
        </p>
      )}
      {meaning && (
        <p className={styles.meaning} lang="en">
          {meaning}
        </p>
      )}
      {examples.length > 0 && (
        <ul className={styles.examples}>
          {examples.map((line, i) => (
            <li key={i} lang="en">
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
