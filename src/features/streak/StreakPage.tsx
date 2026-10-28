import { ArrowLeft, Flame } from 'lucide-react';
import { useLeave } from '../../app/navigation';
import { bestStreak, currentStreak, localDay } from '../../lib/streak';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { MonthCalendar } from './MonthCalendar';
import { WeekDots } from './WeekDots';
import { useStudyDays } from './useStudyDays';
import styles from './Streak.module.css';

export function StreakPage() {
  const leave = useLeave('/');
  const studyDays = useStudyDays();
  if (!studyDays) return null;
  const today = localDay(Date.now());
  const streak = currentStreak(studyDays, today);
  const best = bestStreak(studyDays);
  return (
    <Page top={<TopBar left={<IconButton label="Back" icon={<ArrowLeft size={20} />} onClick={leave} />} title="Streak" />}>
      <section className={`card ${styles.hero}`}>
        <p className={styles.heroCount}>
          <Flame size={34} className={styles.flame} aria-hidden="true" />
          <span data-streak>{streak}</span>
        </p>
        <p className={styles.heroLabel}>day streak</p>
        <p className={styles.best}>
          Best streak: {best} {best === 1 ? 'day' : 'days'}
        </p>
        <WeekDots today={today} studyDays={studyDays} />
      </section>
      <MonthCalendar today={today} studyDays={studyDays} />
    </Page>
  );
}
