import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { monthGrid } from '../../lib/streak';
import styles from './Streak.module.css';

const HEADINGS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const monthTitle = (year: number, month: number) => new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
const monthName = (year: number, month: number) => new Date(year, month, 1).toLocaleString('en', { month: 'long' });

/** One month as a calendar: a green circle on every day a round was completed, a ring around today. */
export function MonthCalendar({ today, studyDays }: { today: string; studyDays: readonly string[] }) {
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;
  const [view, setView] = useState({ year: todayYear, month: todayMonth });

  // browsing is limited to the months between the first study day and now
  const first = [...studyDays].sort()[0] ?? today;
  const firstIndex = Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1;
  const todayIndex = todayYear * 12 + todayMonth;
  const index = view.year * 12 + view.month;
  const go = (delta: number) => {
    const next = index + delta;
    setView({ year: Math.floor(next / 12), month: next % 12 });
  };

  const title = monthTitle(view.year, view.month);
  const name = monthName(view.year, view.month);
  const weeks = monthGrid(view.year, view.month, studyDays, today);
  return (
    <section className={`card ${styles.calendar}`} aria-label="Calendar">
      <div className={styles.calendarHead}>
        <IconButton label="Previous month" icon={<ChevronLeft size={20} />} disabled={index <= firstIndex} onClick={() => go(-1)} />
        <h2 className={styles.monthTitle}>{title}</h2>
        <IconButton label="Next month" icon={<ChevronRight size={20} />} disabled={index >= todayIndex} onClick={() => go(1)} />
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {HEADINGS.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div role="grid" aria-label={title} className={styles.days}>
        {weeks.map((week) => (
          <div role="row" key={week[0].day} className={styles.weekRow}>
            {week.map((c) =>
              c.inMonth ? (
                <span
                  role="gridcell"
                  key={c.day}
                  aria-label={`${c.date} ${name}${c.isToday ? ', today' : ''}${c.done ? ', studied' : c.future || c.isToday ? '' : ', not studied'}`}
                  className={`${styles.day} ${c.done ? styles.dayDone : ''} ${c.isToday ? styles.dayToday : ''} ${c.future ? styles.dayFuture : ''}`}
                >
                  {c.date}
                </span>
              ) : (
                <span role="presentation" key={c.day} className={styles.dayBlank} />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
