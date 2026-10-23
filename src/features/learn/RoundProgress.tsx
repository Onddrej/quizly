import styles from './Learn.module.css';

interface RoundProgressProps {
  /** Cards of this round that are answered correctly. */
  done: number;
  /** Cards in this round. */
  total: number;
}

/** How far along the current round is: what is done and what is left in it (not the state of the whole set). */
export function RoundProgress({ done, total }: RoundProgressProps) {
  const left = total - done;
  return (
    <div className={styles.progress}>
      <span className={styles.done}>{done} done</span>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className={styles.fill} style={{ transform: `scaleX(${total > 0 ? done / total : 0})` }} />
      </div>
      <span className={styles.left}>{left} left</span>
    </div>
  );
}
