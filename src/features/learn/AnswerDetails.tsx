import { splitExamples } from '../../lib/cardDetails';
import { splitByTerm } from './termMatch';
import styles from './Learn.module.css';

/** `text` with the term and its regular forms highlighted. */
function Highlighted({ text, term }: { text: string; term: string }) {
  return (
    <>
      {splitByTerm(text, term).map((part, i) =>
        part.match ? (
          <mark key={i} className={styles.hl}>
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

interface AnswerDetailsProps {
  term: string;
  meaning?: string;
  examples?: string;
}

/**
 * The English definition and the example sentences of a card, shown only once the question has been answered (never while
 * guessing: they would help). The term is highlighted wherever it occurs. Renders nothing when the card has neither.
 */
export function AnswerDetails({ term, meaning, examples }: AnswerDetailsProps) {
  const definition = meaning?.trim();
  const sentences = splitExamples(examples);
  if (!definition && sentences.length === 0) return null;
  return (
    <div className={styles.details}>
      {definition && (
        <>
          <p className={styles.detailLabel}>Definition</p>
          <p className={styles.detailMeaning} lang="en">
            <Highlighted text={definition} term={term} />
          </p>
        </>
      )}
      {sentences.length > 0 && (
        <>
          <p className={styles.detailLabel}>{sentences.length === 1 ? 'Example' : 'Examples'}</p>
          <ul className={styles.detailExamples}>
            {sentences.map((line, i) => (
              <li key={i} lang="en">
                <Highlighted text={line} term={term} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
