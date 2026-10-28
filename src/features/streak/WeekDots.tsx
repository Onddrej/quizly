import { weekDays } from '../../lib/streak';
import styles from './Streak.module.css';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function describe(name: string, state: 'done' | 'open' | 'future', isToday: boolean): string {
  if (state === 'future') return name;
  if (state === 'done') return isToday ? `${name}, today, studied` : `${name}, studied`;
  return isToday ? `${name}, today` : `${name}, not studied`;
}

/** The Monday to Sunday week as seven small circles: green for a studied day, a ring around today. */
export function WeekDots({ today, studyDays }: { today: string; studyDays: readonly string[] }) {
  return (
    <ul className={styles.week}>
      {weekDays(today, studyDays).map((d, i) => (
        <li
          key={d.day}
          aria-label={describe(WEEKDAY_NAMES[i], d.state, d.isToday)}
          className={`${styles.dot} ${d.state === 'done' ? styles.done : ''} ${d.isToday ? styles.today : ''}`}
        >
          <span aria-hidden="true">{d.label}</span>
        </li>
      ))}
    </ul>
  );
}
