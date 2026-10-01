import type { StatusCounts } from '../lib/progress';
import styles from './StageBar.module.css';

interface StageBarProps {
  counts: StatusCounts;
  legend?: boolean;
  size?: 'md' | 'sm';
}

export function StageBar({ counts, legend = false, size = 'md' }: StageBarProps) {
  const total = counts.mastered + counts.learning + counts.notStudied;
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.bar} ${size === 'sm' ? styles.sm : ''}`}
        role="img"
        aria-label={`${counts.mastered} mastered, ${counts.learning} learning, ${counts.notStudied} not studied`}
      >
        <span className={styles.m} style={{ width: pct(counts.mastered) }} />
        <span className={styles.l} style={{ width: pct(counts.learning) }} />
      </div>
      {legend && (
        <div className={styles.legend}>
          <span className={styles.item}>
            <i className={`${styles.dot} ${styles.dotM}`} />
            <b>{counts.mastered}</b> mastered
          </span>
          <span className={styles.item}>
            <i className={`${styles.dot} ${styles.dotL}`} />
            <b>{counts.learning}</b> learning
          </span>
          <span className={styles.item}>
            <i className={`${styles.dot} ${styles.dotN}`} />
            <b>{counts.notStudied}</b> not studied
          </span>
        </div>
      )}
    </div>
  );
}
