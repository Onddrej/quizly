import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import type { Stage } from '../../db/types';

const pairs = { luggage: 'batožina', departure: 'odchod, odlet' } as const;
const typos: Record<string, string> = { luggage: 'lugage', departure: 'departre' };

async function setWithStage(stage: Stage) {
  const id = await createSet({
    title: 'Travel',
    definitionLang: 'sk',
    cards: Object.entries(pairs).map(([term, definition]) => ({ term, definition })),
  });
  await db.cards.where('setId').equals(id).modify({ stage });
  return id;
}

function shownTerm(): keyof typeof pairs {
  const el = screen.getByText(/^(luggage|departure)$/);
  return el.textContent as keyof typeof pairs;
}

function shownDefinitionTerm(): keyof typeof pairs {
  const el = screen.getByText(/^(batožina|odchod, odlet)$/);
  return el.textContent === 'batožina' ? 'luggage' : 'departure';
}

beforeEach(resetDb);

describe('LearnPage', () => {
  it('a correct multiple choice answer moves the term to typing', async () => {
    const id = await setWithStage(0);
    const { user } = renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByText('Choose the matching definition')).toBeInTheDocument();
    const term = shownTerm();
    await user.click(screen.getByRole('button', { name: pairs[term] }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => {
      const card = await db.cards.filter((c) => c.term === term).first();
      expect(card?.stage).toBe(2);
    });
  });

  it('accepts a small typo when typing the English term', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the English term'), typos[shownDefinitionTerm()]);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct, small typo')).toBeInTheDocument();
  });

  it('accepts one comma-separated variant without diacritics when typing the definition', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the definition in Slovak');
    const answer = shownTerm() === 'luggage' ? 'batozina' : 'odlet';
    await user.type(screen.getByLabelText('Type the definition in Slovak'), answer);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('This term is now mastered.')).toBeInTheDocument();
  });

  it('"I was right" counts a wrong typed answer as correct', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the English term'), 'baggage');
    const term = shownDefinitionTerm();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I was right' }));
    expect(screen.getByText('Counted as correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => {
      const card = await db.cards.filter((c) => c.term === term).first();
      expect(card?.stage).toBe(3);
    });
  });

  it('shows the round summary and the completion screen', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    for (let i = 0; i < 2; i++) {
      // Continue saves asynchronously; wait for the next question's input instead of the old disabled one.
      await waitFor(() => expect(screen.getByLabelText('Type the definition in Slovak')).toBeEnabled());
      await user.type(screen.getByLabelText('Type the definition in Slovak'), shownTerm() === 'luggage' ? 'batožina' : 'odchod');
      await user.click(screen.getByRole('button', { name: 'Answer' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2 correct. 2 terms are now mastered.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: "You've mastered all 2 terms" })).toBeInTheDocument();
  });
});
