import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import { listCards } from '../../db/cards';

beforeEach(resetDb);

describe('SetPage', () => {
  it('shows the set, its terms and disables Learn for a single card', async () => {
    const id = await createSet({ title: 'Solo', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    renderRoute(`/sets/${id}`);
    expect(await screen.findByRole('heading', { name: 'Solo' })).toBeInTheDocument();
    expect(screen.getByText('1 term · English → Slovak')).toBeInTheDocument();
    expect(screen.getByText('Add at least 2 cards to use Learn')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Learn/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Flashcards/ })).toHaveAttribute('href', `/sets/${id}/flashcards`);
  });

  it('stars a term', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const { user } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Star gate' }));
    await waitFor(async () => expect((await listCards(id))[0].starred).toBe(true));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Star gate' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('deletes the set after confirmation', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const { user } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Set options' }));
    await user.click(screen.getByRole('button', { name: 'Delete set' }));
    expect(screen.getByText('Delete Travel? This removes 1 card and your progress.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Create your first set')).toBeInTheDocument();
    expect(await db.sets.count()).toBe(0);
  });

  it('shows not found for an unknown set', async () => {
    renderRoute('/sets/missing');
    expect(await screen.findByText("This set doesn't exist")).toBeInTheDocument();
  });
});

describe('SetPage terms list card details', () => {
  it('shows the translation, definition and each example of a card that has them', async () => {
    const id = await createSet({
      title: 'Airport',
      definitionLang: 'sk',
      cards: [
        {
          term: 'departure',
          definition: 'odchod, odlet',
          meaning: 'the act of leaving a place',
          examples: 'The departure was delayed.\nHe waved at her departure.',
        },
      ],
    });
    renderRoute(`/sets/${id}`);
    const row = (await screen.findByText('odchod, odlet')).closest('li') as HTMLElement;
    expect(row).not.toBeNull();
    expect(within(row).getByText('departure')).toHaveAttribute('lang', 'en');
    expect(within(row).getByText('odchod, odlet')).toHaveAttribute('lang', 'sk');
    const meaning = within(row).getByText('the act of leaving a place');
    expect(meaning).toHaveAttribute('lang', 'en');
    const examples = within(row).getAllByRole('listitem');
    expect(examples).toHaveLength(2);
    expect(examples[0]).toHaveTextContent('The departure was delayed.');
    expect(examples[1]).toHaveTextContent('He waved at her departure.');
    expect(row.textContent).toBe('departureodchod, odletthe act of leaving a placeThe departure was delayed.He waved at her departure.');
  });

  it('shows only the term and the translation for a card without details', async () => {
    const id = await createSet({ title: 'Solo', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    renderRoute(`/sets/${id}`);
    const row = (await screen.findByText('brána')).closest('li') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.textContent).toBe('gatebrána');
    expect(within(row).queryByRole('list')).not.toBeInTheDocument();
  });

  it('keeps the translation visible for every card, with or without details', async () => {
    const id = await createSet({
      title: 'Mixed',
      definitionLang: 'sk',
      cards: [
        { term: 'gate', definition: 'brána' },
        { term: 'departure', definition: 'odchod', meaning: 'the act of leaving a place', examples: 'The departure was delayed.' },
      ],
    });
    renderRoute(`/sets/${id}`);
    const gate = (await screen.findByText('brána')).closest('li') as HTMLElement;
    const departure = screen.getByText('odchod').closest('li') as HTMLElement;
    expect(gate).not.toBe(departure);
    expect(within(gate).getByText('brána')).toHaveAttribute('lang', 'sk');
    expect(within(departure).getByText('odchod')).toHaveAttribute('lang', 'sk');
    expect(within(gate).queryByText('the act of leaving a place')).not.toBeInTheDocument();
    expect(within(departure).getByText('the act of leaving a place')).toBeInTheDocument();
  });
});
