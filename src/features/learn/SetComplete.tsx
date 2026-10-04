import { CircleCheck, X } from 'lucide-react';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import styles from './Learn.module.css';

interface SetCompleteProps {
  total: number;
  onStudyAgain: () => void;
  onBack: () => void;
}

export function SetComplete({ total, onStudyAgain, onBack }: SetCompleteProps) {
  return (
    <Page
      top={<TopBar left={<IconButton label="Close" icon={<X size={20} />} onClick={onBack} />} title="Learn" />}
      bottom={
        <div className={styles.bottomActions}>
          <Button block onClick={onStudyAgain}>
            Study again
          </Button>
          <Button variant="ghost" block onClick={onBack}>
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
