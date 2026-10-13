import { Check, X } from 'lucide-react';
import type { Card } from '../../db/types';
import { SpeakButton } from '../../ui/SpeakButton';
import { AnswerDetails } from './AnswerDetails';
import styles from './Learn.module.css';

interface AnswerCardProps {
  card: Pick<Card, 'term' | 'definition' | 'meaning' | 'examples'>;
  /** Language of the translation (the set's definition language). */
  lang: string;
  /** The wrong option that was picked, when the answer was wrong. */
  picked?: string;
}

/**
 * Replaces a multiple choice question once it is answered: the term, the correct translation, and (when the card has
 * them) the definition and example sentences. Nothing here scrolls away under the feedback panel, unlike a block below
 * the options.
 */
export function AnswerCard({ card, lang, picked }: AnswerCardProps) {
  return (
    <section aria-label="Answer" className={`card ${styles.answerCard}`}>
      <div className={styles.promptLabel}>
        <span>Term</span>
        <SpeakButton text={card.term} />
      </div>
      <p className={styles.answerWord} lang="en">
        {card.term}
      </p>
      <p className={styles.answerTranslation} lang={lang}>
        <Check size={18} aria-hidden="true" />
        <span>{card.definition}</span>
      </p>
      {picked !== undefined && (
        <p className={styles.picked}>
          <X size={16} aria-hidden="true" />
          <span>You chose {picked}</span>
        </p>
      )}
      <AnswerDetails term={card.term} meaning={card.meaning} examples={card.examples} />
    </section>
  );
}
