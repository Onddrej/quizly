import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { X } from 'lucide-react';
import { useSetData } from '../../db/useSetData';
import { completeRound, markStudied, resetProgress } from '../../db/sets';
import { setCardStage } from '../../db/cards';
import type { Card, Stage } from '../../db/types';
import { useLeave } from '../../app/navigation';
import { NotFound } from '../../app/NotFound';
import { useSettings } from '../../app/SettingsContext';
import { countStatuses } from '../../lib/progress';
import { languageName } from '../../lib/languages';
import { splitVariants } from '../../lib/text';
import { defaultRng } from '../../lib/random';
import { playCorrect, playWrong } from '../../lib/sounds';
import { useSpeech } from '../../lib/useSpeech';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { IconButton } from '../../ui/IconButton';
import { StageBar } from '../../ui/StageBar';
import { useToast } from '../../ui/Toast';
import { checkAnswer, type AnswerVerdict } from './answerCheck';
import {
  answer,
  currentCardId,
  isRoundFinished,
  isSetMastered,
  pickChoices,
  questionTypeFor,
  startRound,
  summarizeRound,
  type QuestionType,
  type RoundState,
  type RoundSummary as Summary,
} from './engine';
import { AnswerCard } from './AnswerCard';
import { AnswerDetails } from './AnswerDetails';
import { CopyAnswer } from './CopyAnswer';
import { MultipleChoice } from './MultipleChoice';
import { WrittenQuestion } from './WrittenQuestion';
import { Feedback } from './Feedback';
import { RoundSummary } from './RoundSummary';
import { SetComplete } from './SetComplete';
import styles from './Learn.module.css';

interface Pending {
  type: QuestionType;
  outcome: AnswerVerdict | 'skip';
  given: string;
  correct: boolean;
  overridden: boolean;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'asking' }
  | { kind: 'feedback'; pending: Pending }
  | { kind: 'summary'; summary: Summary }
  | { kind: 'complete' };

interface FeedbackCopy {
  title: string;
  body: ReactNode;
  speak?: string;
  canOverrule: boolean;
}

/** A missed card stays in the round until it is answered correctly, so a miss always comes back in this round. */
const AGAIN = "You'll see it again this round.";

function describeFeedback(p: Pending, card: Card, langName: string, stage: Stage): FeedbackCopy {
  const again = AGAIN;
  const next: Record<QuestionType, string> = {
    choice: "Next time you'll type the English term.",
    // A card still at the multiple choice stage can be asked as a typed question (see `type` below): it then goes to stage 2.
    'write-term': stage <= 1 ? "Next time you'll type the English term." : `Next time you'll type the ${langName} translation.`,
    'write-definition': 'This term is now mastered.',
  };
  if (p.overridden) return { title: 'Counted as correct', body: next[p.type], canOverrule: false };
  if (p.type === 'choice') {
    return p.correct
      ? { title: 'Correct', body: next.choice, canOverrule: false }
      : { title: 'Not quite', body: <>The answer is <b>{card.definition}</b>. {again}</>, canOverrule: false };
  }
  const expected = p.type === 'write-term' ? card.term : card.definition;
  const speak = p.type === 'write-term' ? card.term : undefined;
  if (p.outcome === 'exact') return { title: 'Correct', body: next[p.type], speak, canOverrule: false };
  if (p.outcome === 'typo') {
    return {
      title: 'Correct, small typo',
      body: <>You wrote “{p.given}”. Correct spelling: <b>{expected}</b></>,
      speak,
      canOverrule: false,
    };
  }
  const anyOne = p.type === 'write-definition' && splitVariants(expected).length > 1 ? 'Any one of these is enough. ' : '';
  return {
    title: p.outcome === 'skip' ? "Here's the answer" : 'Incorrect',
    body: <>Correct answer: <b>{expected}</b>. {anyOne}{again}</>,
    speak,
    canOverrule: p.outcome === 'wrong',
  };
}

export function LearnPage() {
  const { setId = '' } = useParams();
  const leave = useLeave(`/sets/${setId}`);
  const toast = useToast();
  const speech = useSpeech();
  const { learnAutoplay, learnSounds } = useSettings();
  const { loading, set, cards } = useSetData(setId);
  const [round, setRound] = useState<RoundState | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [roundNumber, setRoundNumber] = useState(1);
  const started = useRef(false);
  const busy = useRef(false);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  // DB writes are async; overlay the stages from the current round so progress is never behind.
  const merged = useMemo(
    () => (round ? cards.map((c) => (c.id in round.stages ? { ...c, stage: round.stages[c.id] } : c)) : cards),
    [cards, round],
  );
  const counts = countStatuses(merged);

  const beginRound = useCallback((source: Card[]) => {
    if (isSetMastered(source)) {
      setRound(null);
      setPhase({ kind: 'complete' });
      return;
    }
    setRound(startRound(source, defaultRng));
    setPhase({ kind: 'asking' });
  }, []);

  useEffect(() => {
    if (loading || !set || started.current) return;
    started.current = true;
    // A round needs at least two cards (the Set page disables Learn for fewer, but the Home link and deep links can still
    // arrive here): leave without starting one. `started` also keeps StrictMode's second effect run from leaving twice.
    if (cards.length < 2) {
      leave();
      return;
    }
    setRoundNumber(set.learnRound);
    void markStudied(set.id).catch(() => undefined); // a failed "last studied" stamp is not worth a toast
    beginRound(cards);
  }, [loading, set, cards, beginRound, leave]);

  const currentId = round ? currentCardId(round) : null;
  const current = currentId ? byId.get(currentId) : undefined;
  const stageType = round && currentId ? questionTypeFor(round.stages[currentId]) : null;
  const questionKey = round && currentId ? `${currentId}:${round.attempts[currentId] ?? 0}` : 'none';
  // New options per question, and when a translation changes (edited or deleted elsewhere); the card list also refreshes
  // after every save (stages, stars) and must not reshuffle them.
  const translationsKey = JSON.stringify(cards.map((c) => [c.id, c.definition]));
  const choices = useMemo(() => (current && stageType === 'choice' ? pickChoices(current, cards, defaultRng) : []), [questionKey, translationsKey]);
  // Fewer than two options (every card shares one translation) would be a free pass: type the English term instead.
  const type = stageType === 'choice' && choices.length < 2 ? 'write-term' : stageType;

  // The English term is read aloud when it is the question (choice, typing the translation). When it is the answer
  // (typing the English term) it stays silent: speaking it would give the answer away.
  const askedTerm = current && type && type !== 'write-term' ? current.term : null;
  const readAloud = learnAutoplay && speech.voicesLoaded && speech.hasEnglish && askedTerm !== null;
  useEffect(() => {
    if (readAloud && askedTerm) speech.say(askedTerm);
  }, [readAloud, questionKey]);

  // A short sound when an answer is graded: right (also a typo, or "I was right") or wrong.
  const gradedAnswer = phase.kind === 'feedback' ? phase.pending : null;
  useEffect(() => {
    if (!gradedAnswer || !learnSounds) return;
    if (gradedAnswer.correct) playCorrect();
    else playWrong();
  }, [gradedAnswer]);

  // After a missed typed answer ("Don't know?" included) the English term is read aloud with the answer: the question
  // that read it is over, and the correct text is on screen now. Not after "I was right" (that turns the answer correct).
  const canSpeak = learnAutoplay && speech.voicesLoaded && speech.hasEnglish;
  useEffect(() => {
    if (!gradedAnswer || gradedAnswer.correct || gradedAnswer.type === 'choice' || !canSpeak || !current) return;
    speech.say(current.term);
  }, [gradedAnswer]);

  // The asked card was deleted in another tab: build a new round from what is left, or leave when too little is left.
  const askedCardGone = round !== null && currentId !== null && current === undefined;
  useEffect(() => {
    if (!askedCardGone) return;
    if (cards.length < 2) leave();
    else beginRound(merged);
  }, [askedCardGone]);

  if (loading) return null;
  if (!set) return <NotFound title="This set doesn't exist" />;

  const langName = languageName(set.definitionLang);

  function submitChoice(picked: string) {
    if (!current) return;
    const correct = picked === current.definition;
    setPhase({ kind: 'feedback', pending: { type: 'choice', outcome: correct ? 'exact' : 'wrong', given: picked, correct, overridden: false } });
  }

  function submitWritten(given: string) {
    if (!current || (type !== 'write-term' && type !== 'write-definition')) return;
    const outcome = type === 'write-term' ? checkAnswer(given, current.term, 'english') : checkAnswer(given, current.definition, 'other');
    setPhase({ kind: 'feedback', pending: { type, outcome, given, correct: outcome !== 'wrong', overridden: false } });
  }

  function dontKnow() {
    if (type !== 'write-term' && type !== 'write-definition') return;
    setPhase({ kind: 'feedback', pending: { type, outcome: 'skip', given: '', correct: false, overridden: false } });
  }

  function overrule() {
    if (phase.kind !== 'feedback') return;
    setPhase({ kind: 'feedback', pending: { ...phase.pending, correct: true, overridden: true } });
  }

  async function next() {
    if (busy.current || !round || !currentId || phase.kind !== 'feedback') return;
    busy.current = true;
    try {
      const result = answer(round, phase.pending.correct);
      try {
        await setCardStage(currentId, result.stage, Date.now());
      } catch {
        // Stay on this feedback: nothing is saved and the round has not moved, so Continue can simply be tried again.
        toast("Couldn't save. Try again.");
        return;
      }
      setRound(result.state);
      if (isRoundFinished(result.state)) {
        await completeRound(setId).catch(() => toast("Couldn't save. Try again."));
        setPhase({ kind: 'summary', summary: summarizeRound(result.state) });
      } else {
        setPhase({ kind: 'asking' });
      }
    } finally {
      busy.current = false;
    }
  }

  function nextRound() {
    setRoundNumber((n) => n + 1);
    beginRound(merged);
  }

  async function studyAgain() {
    try {
      await resetProgress(setId);
    } catch {
      toast("Couldn't save. Try again.");
      return;
    }
    setRoundNumber(1);
    beginRound(cards.map((c) => ({ ...c, stage: 0 as const, lastAnsweredAt: undefined })));
  }

  if (phase.kind === 'complete') return <SetComplete total={cards.length} onStudyAgain={studyAgain} onBack={leave} />;
  if (phase.kind === 'summary') {
    return (
      <RoundSummary
        roundNumber={roundNumber}
        summary={phase.summary}
        cards={byId}
        counts={counts}
        allMastered={counts.mastered === cards.length}
        onContinue={nextRound}
        onBack={leave}
      />
    );
  }
  if (!round || !current || !type) return null;

  const pending = phase.kind === 'feedback' ? phase.pending : null;
  const copy = pending ? describeFeedback(pending, current, langName, round.stages[current.id]) : null;
  // A missed typed answer has to be typed again before the round moves on (shown in the page body, not the bottom panel:
  // a phone keyboard would cover the panel). Multiple choice misses and "I was right" use the panel as before.
  const needsCopy = pending !== null && !pending.correct && (pending.type === 'write-term' || pending.type === 'write-definition');
  // The definition and examples come only after the answer (they would help while guessing).
  const details = pending ? <AnswerDetails term={current.term} meaning={current.meaning} examples={current.examples} /> : null;

  return (
    <Page
      top={<TopBar left={<IconButton label="Close" icon={<X size={20} />} onClick={leave} />} title={`Round ${roundNumber}`} />}
      bottom={
        pending &&
        copy &&
        !needsCopy && (
          <Feedback
            correct={pending.correct}
            title={copy.title}
            speak={copy.speak}
            onContinue={() => void next()}
            onOverrule={copy.canOverrule ? overrule : undefined}
          >
            {copy.body}
          </Feedback>
        )
      }
    >
      <div className={styles.progress}>
        <span className={styles.done}>
          {counts.mastered}
          <span className="visually-hidden"> mastered</span>
        </span>
        <StageBar counts={counts} size="sm" />
        <span className={styles.total}>
          {cards.length}
          <span className="visually-hidden"> terms</span>
        </span>
      </div>
      {type === 'choice' && pending ? (
        <AnswerCard key={`answer:${questionKey}`} card={current} lang={set.definitionLang} picked={pending.correct ? undefined : pending.given} />
      ) : type === 'choice' ? (
        <MultipleChoice key={questionKey} term={current.term} choices={choices} locked={false} onPick={submitChoice} />
      ) : (
        <WrittenQuestion
          key={questionKey}
          label={type === 'write-term' ? 'Translation' : 'Term'}
          prompt={type === 'write-term' ? current.definition : current.term}
          promptLang={type === 'write-term' ? set.definitionLang : 'en'}
          speak={type === 'write-definition' ? current.term : undefined}
          instruction={type === 'write-term' ? 'Type the English term' : `Type the translation in ${langName}`}
          locked={pending !== null}
          retype={needsCopy}
          result={pending ? (pending.correct ? 'ok' : 'no') : null}
          onSubmit={submitWritten}
          onDontKnow={dontKnow}
        />
      )}
      {needsCopy && pending && copy ? (
        <CopyAnswer
          key={`copy:${questionKey}`}
          title={copy.title}
          expected={pending.type === 'write-term' ? current.term : current.definition}
          language={pending.type === 'write-term' ? 'english' : 'other'}
          speak={copy.speak}
          written={pending.outcome === 'wrong' ? pending.given : undefined}
          details={details}
          onMatch={() => {
            // the missed answer is now typed correctly: the same short confirmation as for a right answer
            if (learnSounds) playCorrect();
            void next();
          }}
          onOverrule={copy.canOverrule ? overrule : undefined}
        >
          {copy.body}
        </CopyAnswer>
      ) : type === 'choice' ? null : (
        details
      )}
    </Page>
  );
}
