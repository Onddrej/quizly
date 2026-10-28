import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import type { Stage } from '../../db/types';

// Spaced review in Learn. No study days unless a test adds some: the lesson in progress is lesson 1.
beforeEach(resetDb);

const cardFields = (term: string, fields: Partial<{ stage: Stage; reviewStep: number; nextReviewLesson: number }>) =>
  db.cards.filter((c) => c.term === term).modify(fields);

async function reviewSet(cards: Record<string, string> = { luggage: 'batožina', departure: 'odchod, odlet' }) {
  return createSet({
    title: 'Review',
    definitionLang: 'sk',
    cards: Object.entries(cards).map(([term, definition]) => ({ term, definition })),
  });
}

const raw = async (term: string) => (await db.cards.filter((c) => c.term === term).first()) as unknown as Record<string, unknown>;
const shownCorrectAnswer = () =>
  within(screen.getByRole('region', { name: 'Correct answer' })).getByText((_, el) => el?.tagName === 'B').textContent!;

async function copyAnswer(user: UserEvent) {
  await user.type(screen.getByLabelText('Type the answer to continue'), shownCorrectAnswer());
  await user.click(screen.getByRole('button', { name: 'Continue' }));
}

describe('LearnPage spaced review', () => {
  it('asks a due mastered card by typing instead of showing the completion screen', async () => {
    const id = await reviewSet();
    await cardFields('luggage', { stage: 4, reviewStep: 0, nextReviewLesson: 1 });
    await cardFields('departure', { stage: 4, reviewStep: 0, nextReviewLesson: 50 });
    renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByLabelText('Type the translation in Slovak')).toBeInTheDocument();
    expect(screen.getByText('luggage')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /mastered all/i })).not.toBeInTheDocument();
    expect(screen.getByText('0 done')).toBeInTheDocument();
    expect(screen.getByText('1 left')).toBeInTheDocument();
  });

  it('asks the other direction at the next review step', async () => {
    const id = await reviewSet();
    await cardFields('luggage', { stage: 4, reviewStep: 1, nextReviewLesson: 1 });
    await cardFields('departure', { stage: 4, reviewStep: 0, nextReviewLesson: 50 });
    renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByLabelText('Type the English term')).toBeInTheDocument();
    expect(screen.getByText('batožina')).toBeInTheDocument();
  });

  it('keeps a reviewed card mastered when it is answered right, and moves its next review 7 lessons on', async () => {
    const id = await reviewSet();
    await cardFields('luggage', { stage: 4, reviewStep: 0, nextReviewLesson: 1 });
    await cardFields('departure', { stage: 4, reviewStep: 0, nextReviewLesson: 50 });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the translation in Slovak'), 'batožina');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText(/Still mastered/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect(await raw('luggage')).toMatchObject({ stage: 4, reviewStep: 1, nextReviewLesson: 8 }));
  });

  it('sends a missed card back to learning and clears its schedule', async () => {
    const id = await reviewSet();
    await cardFields('luggage', { stage: 4, reviewStep: 2, nextReviewLesson: 1 });
    await cardFields('departure', { stage: 4, reviewStep: 0, nextReviewLesson: 50 });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.click(await screen.findByRole('button', { name: "Don't know?" }));
    await copyAnswer(user);
    await waitFor(async () => {
      const card = await raw('luggage');
      expect(card.stage).toBe(2); // back to typing the English term
      expect(Object.hasOwn(card, 'reviewStep')).toBe(false);
      expect(Object.hasOwn(card, 'nextReviewLesson')).toBe(false);
    });
  });

  it('schedules the first review 3 lessons ahead when a card becomes mastered', async () => {
    const id = await reviewSet({ luggage: 'batožina', departure: 'odlet' });
    await cardFields('luggage', { stage: 3 });
    await cardFields('departure', { stage: 3 });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const term = screen.getByText(/^(luggage|departure)$/).textContent!;
    await user.type(screen.getByLabelText('Type the translation in Slovak'), term === 'luggage' ? 'batožina' : 'odlet');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect(await raw(term)).toMatchObject({ stage: 4, reviewStep: 0, nextReviewLesson: 4 }));
  });

  it('counts lessons as the days studied so far: after 5 study days the lesson in progress is the sixth', async () => {
    await db.studyDays.bulkPut(['2026-01-20', '2026-01-21', '2026-01-22', '2026-01-23', '2026-01-24'].map((day) => ({ day, rounds: 1 })));
    const id = await reviewSet({ luggage: 'batožina', departure: 'odlet' });
    await cardFields('luggage', { stage: 3 });
    await cardFields('departure', { stage: 3 });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const term = screen.getByText(/^(luggage|departure)$/).textContent!;
    await user.type(screen.getByLabelText('Type the translation in Slovak'), term === 'luggage' ? 'batožina' : 'odlet');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect(await raw(term)).toMatchObject({ nextReviewLesson: 9 }));
  });

  it('gives cards mastered before spaced review existed their first review, 3 lessons ahead, when Learn opens', async () => {
    const id = await reviewSet({ luggage: 'batožina', departure: 'odchod, odlet', gate: 'brána' });
    await cardFields('luggage', { stage: 4 });
    renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    await waitFor(async () => expect(await raw('luggage')).toMatchObject({ reviewStep: 0, nextReviewLesson: 4 }));
  });

  it('shows the completion screen when everything is mastered and nothing is due yet', async () => {
    const id = await reviewSet();
    await cardFields('luggage', { stage: 4, reviewStep: 0, nextReviewLesson: 20 });
    await cardFields('departure', { stage: 4, reviewStep: 0, nextReviewLesson: 20 });
    renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByRole('heading', { name: "You've mastered all 2 terms" })).toBeInTheDocument();
  });

  it('mixes at most two due cards into a round with cards that are still being learned', async () => {
    const names = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    const id = await reviewSet(Object.fromEntries(names.map((n) => [n, `${n}x`])));
    for (const n of ['a1', 'a2', 'a3']) await cardFields(n, { stage: 4, reviewStep: 0, nextReviewLesson: 1 });
    renderRoute(`/sets/${id}/learn`);
    // 5 cards still to learn plus 2 reviews make a round of 7
    expect(await screen.findByText('7 left')).toBeInTheDocument();
  });
});
