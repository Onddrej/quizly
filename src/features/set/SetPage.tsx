import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronRight, Ellipsis, GalleryVerticalEnd, Pencil, RotateCcw, Star, Target, Trash2 } from 'lucide-react';
import { useSetData } from '../../db/useSetData';
import { deleteSet, resetProgress } from '../../db/sets';
import { toggleStar } from '../../db/cards';
import { NotFound } from '../../app/NotFound';
import { useLeave } from '../../app/navigation';
import { countStatuses } from '../../lib/progress';
import { languageName } from '../../lib/languages';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { SpeakButton } from '../../ui/SpeakButton';
import { StageBar } from '../../ui/StageBar';
import { CardBack } from '../../ui/CardBack';
import { Sheet } from '../../ui/Sheet';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { useToast } from '../../ui/Toast';
import styles from './SetPage.module.css';

const PEEK_LIMIT = 10;

interface ModeRowProps {
  to: string;
  icon: ReactNode;
  name: string;
  hint: string;
  disabled: boolean;
}

function ModeRow({ to, icon, name, hint, disabled }: ModeRowProps) {
  const content = (
    <>
      <span className={styles.modeIcon}>{icon}</span>
      <span className={styles.modeText}>
        <span className={styles.modeName}>{name}</span>
        <span className={styles.meta}>{hint}</span>
      </span>
      {!disabled && <ChevronRight size={20} className={styles.chevron} />}
    </>
  );
  if (disabled) {
    return (
      <div className={`card ${styles.mode} ${styles.modeDisabled}`} aria-disabled="true">
        {content}
      </div>
    );
  }
  return (
    <Link to={to} className={`card ${styles.mode}`}>
      {content}
    </Link>
  );
}

export function SetPage() {
  const { setId = '' } = useParams();
  const navigate = useNavigate();
  const leaveToHome = useLeave('/');
  const toast = useToast();
  const { loading, set, cards } = useSetData(setId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const [peekIndex, setPeekIndex] = useState(0);

  if (loading) return null;
  if (!set) return <NotFound title="This set doesn't exist" />;
  const current = set;

  const counts = countStatuses(cards);
  const canLearn = cards.length >= 2;
  const peek = cards.slice(0, PEEK_LIMIT);
  const cardWord = (n: number) => (n === 1 ? 'card' : 'cards');

  function closeMenu() {
    setMenuOpen(false);
    setConfirm(null);
  }

  async function onReset() {
    try {
      await resetProgress(current.id);
      closeMenu();
      toast('Progress reset');
    } catch {
      toast("Couldn't save. Try again.");
    }
  }

  async function onDelete() {
    try {
      await deleteSet(current.id);
      navigate('/', { replace: true });
    } catch {
      toast("Couldn't delete. Try again.");
    }
  }

  return (
    <Page
      top={
        <TopBar
          left={<IconButton label="Back" icon={<ArrowLeft size={20} />} onClick={leaveToHome} />}
          right={<IconButton label="Set options" icon={<Ellipsis size={20} />} onClick={() => setMenuOpen(true)} />}
        />
      }
    >
      {peek.length > 0 && (
        <>
          <div
            className={styles.peek}
            role="group"
            aria-label="Card preview"
            onScroll={(e) => {
              const el = e.currentTarget;
              const step = el.scrollWidth / peek.length;
              setPeekIndex(Math.min(peek.length - 1, Math.round(el.scrollLeft / step)));
            }}
          >
            {peek.map((c) => (
              <div key={c.id} className={`card ${styles.peekCard}`}>
                <SpeakButton text={c.term} />
                <span className={styles.peekWord} lang="en">
                  {c.term}
                </span>
              </div>
            ))}
          </div>
          {peek.length > 1 && (
            <div className={styles.dots} aria-hidden="true">
              {peek.map((c, i) => (
                <span key={c.id} className={`${styles.dot} ${i === peekIndex ? styles.dotOn : ''}`} />
              ))}
            </div>
          )}
        </>
      )}

      <div className={styles.head}>
        <h1 className={styles.title}>{current.title}</h1>
        <p className={styles.meta}>
          {cards.length} {cards.length === 1 ? 'term' : 'terms'} · English → {languageName(current.definitionLang)}
        </p>
      </div>

      <div className={styles.modes}>
        <ModeRow
          to={`/sets/${current.id}/flashcards`}
          icon={<GalleryVerticalEnd size={22} />}
          name="Flashcards"
          hint="Flip and sort what you know"
          disabled={cards.length === 0}
        />
        <ModeRow
          to={`/sets/${current.id}/learn`}
          icon={<Target size={22} />}
          name="Learn"
          hint={canLearn ? 'Multiple choice, then typing both ways' : 'Add at least 2 cards to use Learn'}
          disabled={!canLearn}
        />
      </div>

      <div className={`card ${styles.progress}`}>
        <StageBar counts={counts} legend />
      </div>

      <h2 className={styles.termsTitle}>Terms</h2>
      <ul className={styles.terms}>
        {cards.map((c) => (
          <li key={c.id} className={`card ${styles.term}`}>
            <span className={styles.termText}>
              <span className={styles.t} lang="en">
                {c.term}
              </span>
              <CardBack card={c} lang={current.definitionLang} variant="row" />
            </span>
            <SpeakButton text={c.term} />
            <IconButton
              tone="star"
              label={`Star ${c.term}`}
              aria-pressed={c.starred}
              icon={<Star size={20} />}
              onClick={() => void toggleStar(c.id)}
            />
          </li>
        ))}
      </ul>

      <Sheet open={menuOpen} title="Set options" onClose={closeMenu}>
        {confirm === null && (
          <div className={styles.menu}>
            <Link to={`/sets/${current.id}/edit`} className={styles.menuItem}>
              <Pencil size={20} />
              Edit set
            </Link>
            <button type="button" className={styles.menuItem} onClick={() => setConfirm('reset')}>
              <RotateCcw size={20} />
              Reset progress
            </button>
            <button type="button" className={`${styles.menuItem} ${styles.danger}`} onClick={() => setConfirm('delete')}>
              <Trash2 size={20} />
              Delete set
            </button>
          </div>
        )}
        {confirm === 'reset' && (
          <InlineConfirm
            message="Reset progress? All terms go back to not studied."
            confirmLabel="Reset"
            onConfirm={onReset}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm === 'delete' && (
          <InlineConfirm
            message={`Delete ${current.title}? This removes ${cards.length} ${cardWord(cards.length)} and your progress.`}
            confirmLabel="Delete"
            danger
            onConfirm={onDelete}
            onCancel={() => setConfirm(null)}
          />
        )}
      </Sheet>
    </Page>
  );
}
