import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, GalleryVerticalEnd, Search, Target, X } from 'lucide-react';
import { listSetSummaries, type SetSummary } from '../../db/sets';
import { normalize } from '../../lib/text';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { TabBar } from '../../ui/TabBar';
import { IconButton } from '../../ui/IconButton';
import { StageBar } from '../../ui/StageBar';
import { EmptyState } from '../../ui/EmptyState';
import { buttonClassName } from '../../ui/Button';
import styles from './HomePage.module.css';

function describeSet(summary: SetSummary): string {
  const terms = `${summary.total} ${summary.total === 1 ? 'term' : 'terms'}`;
  if (summary.counts.mastered === 0 && summary.counts.learning === 0) return `${terms} · not started`;
  return `${terms} · ${summary.counts.mastered} mastered`;
}

function ResumeCard({ summary }: { summary: SetSummary }) {
  const { set, counts } = summary;
  return (
    <article className={`card ${styles.resume}`}>
      <div className={styles.resumeTop}>
        <div>
          <p className={styles.resumeTitle}>{set.title}</p>
          <p className={styles.meta}>
            {summary.total} {summary.total === 1 ? 'term' : 'terms'}
          </p>
        </div>
        <span className={styles.chip}>
          <Target size={14} />
          Learn
        </span>
      </div>
      <StageBar counts={counts} size="sm" />
      <p className={styles.meta}>
        {counts.mastered} mastered · {counts.learning} learning · round {set.learnRound}
      </p>
      <Link to={`/sets/${set.id}/learn`} className={buttonClassName('primary', true)}>
        Continue learning
      </Link>
    </article>
  );
}

export function HomePage() {
  const summaries = useLiveQuery(listSetSummaries, []);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim();
  const filtered = useMemo(() => {
    const needle = normalize(q);
    return (summaries ?? []).filter((s) => !needle || normalize(s.set.title).includes(needle));
  }, [summaries, q]);
  const resume = summaries?.find((s) => s.set.lastStudiedAt !== undefined);

  const searchToggle = (
    <IconButton
      label={searching ? 'Close search' : 'Search sets'}
      icon={searching ? <X size={20} /> : <Search size={20} />}
      onClick={() => {
        setSearching((v) => !v);
        setQuery('');
      }}
    />
  );

  return (
    <Page
      top={<TopBar left={<h1 className={styles.wordmark}>Quizly</h1>} right={summaries?.length ? searchToggle : null} />}
      bottom={<TabBar />}
    >
      {summaries === undefined ? null : summaries.length === 0 ? (
        <EmptyState
          icon={<GalleryVerticalEnd size={30} />}
          title="Create your first set"
          text="Paste a word list and start learning in a minute."
          action={
            <Link to="/create" className={buttonClassName('primary')}>
              Create set
            </Link>
          }
        />
      ) : (
        <>
          {searching && (
            <input
              autoFocus
              type="search"
              enterKeyHint="search"
              aria-label="Search sets"
              placeholder="Search your sets"
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {resume && !q && (
            <section className={styles.section} aria-labelledby="resume-heading">
              <h2 id="resume-heading" className={styles.sectionTitle}>
                Jump back in
              </h2>
              <ResumeCard summary={resume} />
            </section>
          )}
          <section className={styles.section} aria-labelledby="sets-heading">
            <h2 id="sets-heading" className={styles.sectionTitle}>
              Your sets
            </h2>
            {filtered.length === 0 ? (
              <p className={styles.noResults}>No sets match “{q}”.</p>
            ) : (
              <ul className={styles.list}>
                {filtered.map((s) => (
                  <li key={s.set.id}>
                    <Link to={`/sets/${s.set.id}`} className={`card ${styles.row}`}>
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle}>{s.set.title}</span>
                        <span className={styles.meta}>{describeSet(s)}</span>
                      </span>
                      <ChevronRight size={20} className={styles.chevron} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
