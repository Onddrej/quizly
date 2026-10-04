import { useEffect, useRef } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { Card } from '../../db/types';
import type { StatusCounts } from '../../lib/progress';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { StageBar } from '../../ui/StageBar';
import { SpeakButton } from '../../ui/SpeakButton';
import type { RoundSummary as Summary } from './engine';
import styles from './Learn.module.css';

interface RoundSummaryProps {
  roundNumber: number;
  summary: Summary;
  cards: Map<string, Card>;
  counts: StatusCounts;
  allMastered: boolean;
  onContinue: () => void;
  onBack: () => void;
}

/** A double tap on the last Continue of a round must not also hit "Back to set", which appears under the same finger. */
const TAP_GUARD_MS = 350;

const TAGS = {
  M: { label: 'Mastered', icon: styles.stateM, tag: styles.tagM },
  C: { label: 'Correct', icon: styles.stateC, tag: styles.tagC },
  A: { label: 'Again', icon: styles.stateA, tag: styles.tagA },
} as const;

export function RoundSummary({ roundNumber, summary, cards, counts, allMastered, onContinue, onBack }: RoundSummaryProps) {
  const n = summary.newlyMastered.length;
  const ready = useRef(false);
  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => {
      ready.current = true;
    }, TAP_GUARD_MS);
    return () => clearTimeout(timer);
  }, []);
  const whenReady = (action: () => void) => () => {
    if (ready.current) action();
  };
  const masteredText = n === 0 ? '' : n === 1 ? ' 1 term is now mastered.' : ` ${n} terms are now mastered.`;
  return (
    <Page
      top={<TopBar left={<IconButton label="Close" icon={<X size={20} />} onClick={onBack} />} title={`Round ${roundNumber}`} />}
      bottom={
        <div className={styles.bottomActions}>
          <Button block onClick={whenReady(onContinue)}>
            {allMastered ? 'Continue' : `Continue to round ${roundNumber + 1}`}
          </Button>
          <Button variant="ghost" block onClick={whenReady(onBack)}>
            Back to set
          </Button>
        </div>
      }
    >
      <div className={styles.summaryHead}>
        <h2>Round {roundNumber} done</h2>
        <p>
          {summary.correctFirstTry} of {summary.total} correct.{masteredText}
        </p>
      </div>
      <div className={`card ${styles.box}`}>
        <StageBar counts={counts} legend />
      </div>
      <h3 className={styles.sectionTitle}>In this round</h3>
      <ul className={styles.results}>
        {summary.results.map((result) => {
          const card = cards.get(result.cardId);
          if (!card) return null;
          const kind = result.stage === 4 ? TAGS.M : result.firstTry ? TAGS.C : TAGS.A;
          return (
            <li key={result.cardId} className={`card ${styles.result}`}>
              <span className={`${styles.stateIcon} ${kind.icon}`}>
                {kind === TAGS.A ? <RotateCcw size={16} /> : <Check size={16} />}
              </span>
              <span className={styles.resultText}>
                <b lang="en">{card.term}</b>
                <span>{card.definition}</span>
              </span>
              <SpeakButton text={card.term} size="sm" />
              <span className={`${styles.tag} ${kind.tag}`}>{kind.label}</span>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
