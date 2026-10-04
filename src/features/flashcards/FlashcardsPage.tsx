import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useParams } from 'react-router';
import { Check, RotateCcw, Shuffle, SlidersHorizontal, Star, Undo2, X } from 'lucide-react';
import { useSetData } from '../../db/useSetData';
import { markStudied } from '../../db/sets';
import { toggleStar } from '../../db/cards';
import { saveSetting } from '../../db/settings';
import type { FlashcardPrefs } from '../../db/types';
import { useSettings } from '../../app/SettingsContext';
import { useLeave } from '../../app/navigation';
import { NotFound } from '../../app/NotFound';
import { shuffle } from '../../lib/random';
import { languageName } from '../../lib/languages';
import { useSpeech } from '../../lib/useSpeech';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { SpeakButton } from '../../ui/SpeakButton';
import { Button } from '../../ui/Button';
import { CardBack } from '../../ui/CardBack';
import { Sheet } from '../../ui/Sheet';
import { Switch } from '../../ui/Switch';
import { flashcardReducer, initialFlashcardState, isFinished, tally, type SortResult } from './flashcardSession';
import styles from './FlashcardsPage.module.css';

const SWIPE_DISTANCE = 80;
const TAP_TOLERANCE = 10;
const stopPointer = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function FlashcardsPage() {
  const { setId = '' } = useParams();
  const leave = useLeave(`/sets/${setId}`);
  const { flashcards: prefs } = useSettings();
  const { available: canSpeak, say } = useSpeech();
  const { loading, set, cards } = useSetData(setId);
  const [state, dispatch] = useReducer(flashcardReducer, [], initialFlashcardState);
  const [shuffled, setShuffled] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const anyStarred = cards.some((c) => c.starred);
  const deckIds = useMemo(
    () => (prefs.starredOnly && anyStarred ? cards.filter((c) => c.starred) : cards).map((c) => c.id),
    [cards, prefs.starredOnly, anyStarred],
  );
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const restart = useCallback((ids: string[], doShuffle: boolean) => {
    dispatch({ type: 'start', order: doShuffle ? shuffle(ids) : ids });
  }, []);
  const sort = useCallback((result: SortResult) => dispatch({ type: 'sort', result }), []);

  const loadedSetId = set?.id;
  // A new pass starts when the set loads or the starred filter changes, not when a card is edited or starred.
  useEffect(() => {
    if (loadedSetId) restart(deckIds, shuffled);
  }, [loadedSetId, prefs.starredOnly]);

  useEffect(() => {
    if (loadedSetId) void markStudied(loadedSetId);
  }, [loadedSetId]);

  const current = byId.get(state.order[state.index] ?? '');
  const termOnFront = !prefs.startWithDefinition;
  const termVisible = termOnFront ? !state.flipped : state.flipped;
  const finished = isFinished(state);
  const counts = tally(state);

  useEffect(() => {
    if (prefs.autoplay && current && termVisible) say(current.term);
  }, [current?.id, termVisible, prefs.autoplay]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (optionsOpen || finished) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') sort('know');
      else if (e.key === 'ArrowLeft') sort('learning');
      else if (e.key === ' ' && !target?.closest('button, a')) {
        e.preventDefault();
        dispatch({ type: 'flip' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [optionsOpen, finished, sort]);

  if (loading) return null;
  if (!set) return <NotFound title="This set doesn't exist" />;

  const savePrefs = (patch: Partial<FlashcardPrefs>) => void saveSetting('flashcards', { ...prefs, ...patch });
  const closeButton = <IconButton label="Close" icon={<X size={20} />} onClick={leave} />;

  if (finished) {
    return (
      <Page top={<TopBar left={closeButton} title="Flashcards" />}>
        <div className={styles.done}>
          <h2>Deck finished</h2>
          <p>
            You know {counts.know} · Still learning {counts.learning}
          </p>
          {counts.learning > 0 && (
            <Button block onClick={() => restart(counts.learningIds, shuffled)}>
              Study {counts.learning} again
            </Button>
          )}
          <Button variant="outline" block onClick={() => restart(deckIds, shuffled)}>
            Restart all
          </Button>
          <Button variant="ghost" block onClick={leave}>
            Back to set
          </Button>
        </div>
      </Page>
    );
  }

  const total = state.order.length;
  const definitionLabel = languageName(set.definitionLang);

  // A gesture is measured on both axes: a mostly vertical drag is the user scrolling tall card content (the browser
  // normally takes it over and cancels the pointer), so it must neither move the card nor flip or sort it.
  function dragDelta(e: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    return start ? { dx: (e.clientX ?? 0) - start.x, dy: (e.clientY ?? 0) - start.y } : null;
  }
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStart.current = { x: e.clientX ?? 0, y: e.clientY ?? 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const delta = dragDelta(e);
    if (delta) setDragX(Math.abs(delta.dy) > Math.abs(delta.dx) ? 0 : delta.dx);
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const delta = dragDelta(e);
    if (!delta) return;
    const { dx, dy } = delta;
    dragStart.current = null;
    setDragX(0);
    if (Math.abs(dx) < TAP_TOLERANCE && Math.abs(dy) < TAP_TOLERANCE) dispatch({ type: 'flip' });
    else if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > SWIPE_DISTANCE) sort('know');
      else if (dx < -SWIPE_DISTANCE) sort('learning');
    }
  }
  function onPointerCancel() {
    dragStart.current = null;
    setDragX(0);
  }

  function face(side: 'front' | 'back') {
    if (!current || !set) return null;
    const isTerm = side === 'front' ? termOnFront : !termOnFront;
    const hidden = side === 'front' ? state.flipped : !state.flipped;
    return (
      <div className={`${styles.face} ${side === 'back' ? styles.back : ''}`} aria-hidden={hidden}>
        <div className={styles.faceTop}>
          {isTerm ? <SpeakButton text={current.term} /> : <span className={styles.lang}>{definitionLabel}</span>}
          {side === 'front' ? (
            <IconButton
              tone="star"
              label={`Star ${current.term}`}
              aria-pressed={current.starred}
              icon={<Star size={20} />}
              onPointerDown={stopPointer}
              onPointerUp={stopPointer}
              onClick={(e) => {
                e.stopPropagation();
                void toggleStar(current.id);
              }}
            />
          ) : (
            <span />
          )}
        </div>
        {isTerm ? (
          <p className={styles.word} lang="en">
            {current.term}
          </p>
        ) : (
          // Keyed by card so a scrolled answer block does not hand its scroll position to the next card.
          <CardBack key={current.id} card={current} lang={set.definitionLang} variant="face" />
        )}
        <span className={styles.tap}>{side === 'front' ? 'Tap to flip' : 'Tap to flip back'}</span>
      </div>
    );
  }

  return (
    <Page
      top={
        <TopBar
          left={closeButton}
          title={`${Math.min(state.index + 1, total)} / ${total}`}
          right={<IconButton label="Flashcard options" icon={<SlidersHorizontal size={20} />} onClick={() => setOptionsOpen(true)} />}
        />
      }
    >
      <div className={styles.thin} aria-hidden="true">
        <span style={{ width: `${total ? (state.index / total) * 100 : 0}%` }} />
      </div>
      <div className={styles.counts}>
        <span className={`${styles.count} ${styles.learning}`} aria-label={`Still learning: ${counts.learning}`}>
          <RotateCcw size={14} />
          {counts.learning}
        </span>
        <span className={`${styles.count} ${styles.know}`} aria-label={`Know: ${counts.know}`}>
          {counts.know}
          <Check size={14} />
        </span>
      </div>

      <div className={styles.stage}>
        <div
          role="button"
          tabIndex={0}
          aria-label={state.flipped ? 'Show front of card' : 'Flip card'}
          className={`${styles.card} ${state.flipped ? styles.flipped : ''} ${dragX ? styles.dragging : ''}`}
          style={dragX ? { transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)` } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') dispatch({ type: 'flip' });
          }}
        >
          <div className={styles.inner}>
            {face('front')}
            {face('back')}
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <IconButton
          label="Undo last card"
          icon={<Undo2 size={20} />}
          disabled={state.history.length === 0}
          onClick={() => dispatch({ type: 'undo' })}
        />
        <button type="button" className={`${styles.sort} ${styles.no}`} aria-label="Still learning" onClick={() => sort('learning')}>
          <X size={26} />
        </button>
        <button type="button" className={`${styles.sort} ${styles.yes}`} aria-label="Know it" onClick={() => sort('know')}>
          <Check size={26} />
        </button>
        <IconButton
          label="Shuffle"
          aria-pressed={shuffled}
          tone={shuffled ? 'accent' : 'default'}
          icon={<Shuffle size={20} />}
          onClick={() => {
            const next = !shuffled;
            setShuffled(next);
            restart(deckIds, next);
          }}
        />
      </div>

      <Sheet open={optionsOpen} title="Flashcard options" onClose={() => setOptionsOpen(false)}>
        <Switch
          id="fc-definition-first"
          label="Start with definition"
          checked={prefs.startWithDefinition}
          onChange={(v) => savePrefs({ startWithDefinition: v })}
        />
        {anyStarred && (
          <Switch id="fc-starred" label="Starred only" checked={prefs.starredOnly} onChange={(v) => savePrefs({ starredOnly: v })} />
        )}
        {canSpeak && (
          <Switch
            id="fc-autoplay"
            label="Read term aloud automatically"
            checked={prefs.autoplay}
            onChange={(v) => savePrefs({ autoplay: v })}
          />
        )}
      </Sheet>
    </Page>
  );
}
