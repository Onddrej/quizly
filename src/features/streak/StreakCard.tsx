import { Link } from 'react-router';
import { ChevronRight, Flame } from 'lucide-react';
import { currentStreak, localDay } from '../../lib/streak';
import { WeekDots } from './WeekDots';
import styles from './Streak.module.css';

/** The streak on Home: the number, the week, and what is left to do today. Opens the streak page. */
export function StreakCard({ studyDays }: { studyDays: readonly string[] }) {
  const today = localDay(Date.now());
  const streak = currentStreak(studyDays, today);
  const doneToday = studyDays.includes(today);
  const hint = doneToday ? 'Done for today' : streak > 0 ? 'Finish a round today to keep it' : 'Finish a round today to start a streak';
  return (
    <Link to="/streak" className={`card ${styles.card}`}>
      <div className={styles.cardTop}>
        <span className={styles.count}>
          <Flame size={26} className={styles.flame} aria-hidden="true" />
          <span>{streak}</span>
          <span className={styles.countLabel}>day streak</span>
        </span>
        <ChevronRight size={20} className={styles.chevron} aria-hidden="true" />
      </div>
      <WeekDots today={today} studyDays={studyDays} />
      <p className={styles.hint}>{hint}</p>
    </Link>
  );
}
