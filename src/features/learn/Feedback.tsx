import { useEffect, useRef, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { SpeakButton } from '../../ui/SpeakButton';
import styles from './Learn.module.css';

interface FeedbackProps {
  correct: boolean;
  title: string;
  children: ReactNode;
  speak?: string;
  onContinue: () => void;
  onOverrule?: () => void;
}

/** Bottom panel after an answer. Continue gets focus, so Enter moves on (spec 5.2). */
export function Feedback({ correct, title, children, speak, onContinue, onOverrule }: FeedbackProps) {
  const continueButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueButton.current?.focus();
  }, [correct]);

  return (
    <div className={`${styles.panel} ${correct ? styles.ok : styles.no}`} role="status" aria-live="polite">
      <div className={styles.msg}>
        <span className={styles.icon}>{correct ? <Check size={20} /> : <X size={20} />}</span>
        <div className={styles.text}>
          <p className={styles.title}>{title}</p>
          <div className={styles.sub}>{children}</div>
        </div>
        {speak && <SpeakButton text={speak} />}
      </div>
      <div className={styles.actions}>
        {onOverrule && (
          <Button variant="ghost" onClick={onOverrule}>
            I was right
          </Button>
        )}
        <Button ref={continueButton} block onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
