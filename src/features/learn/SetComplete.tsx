import { CircleCheck, X } from 'lucide-react';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { useTapGuard } from '../../ui/useTapGuard';
import styles from './Learn.module.css';

interface SetCompleteProps {
  total: number;
  onStudyAgain: () => void;
  onBack: () => void;
}

export function SetComplete({ total, onStudyAgain, onBack }: SetCompleteProps) {
  // The last Continue of a round leads here: a double tap must not land on "Study again", which resets all progress.
  const guard = useTapGuard();
  return (
    <Page
      top={<TopBar left={<IconButton label="Close" icon={<X size={20} />} onClick={onBack} />} title="Learn" />}
      bottom={
        <div className={styles.bottomActions}>
          <Button block onClick={guard(onStudyAgain)}>
            Study again
          </Button>
          <Button variant="ghost" block onClick={guard(onBack)}>
            Back to set
          </Button>
        </div>
      }
    >
      <div className={styles.complete}>
        <span className={styles.completeIcon}>
          <CircleCheck size={36} />
        </span>
        <h2>You've mastered all {total} terms</h2>
        <p>Every term passed multiple choice and typing in both directions.</p>
      </div>
    </Page>
  );
}
