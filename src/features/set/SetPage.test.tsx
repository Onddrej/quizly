import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('toasts when starring a term fails, and the star stays off', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const { user } = renderRoute(`/sets/${id}`);
    const star = await screen.findByRole('button', { name: 'Star gate' });
    const spy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('disk full'));
    try {
      await user.click(star);
      expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
      expect(star).toHaveAttribute('aria-pressed', 'false');
    } finally {
      spy.mockRestore();
    }
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

describe('SetPage options and navigation', () => {
  it('resets progress after confirmation and keeps the stars', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }, { term: 'delay', definition: 'meškanie' }] });
    const [a, b] = await listCards(id);
    await db.cards.update(a.id, { stage: 4, starred: true, lastAnsweredAt: 1 });
    await db.cards.update(b.id, { stage: 2 });
    await db.sets.update(id, { learnRound: 3 });
    const { user } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Set options' }));
    await user.click(screen.getByRole('button', { name: 'Reset progress' }));
    expect(screen.getByText('Reset progress? All terms go back to not studied.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('Progress reset')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const after = await listCards(id);
    expect(after.map((c) => c.stage)).toEqual([0, 0]);
    expect(after[0].starred).toBe(true);
    expect((await db.sets.get(id))?.learnRound).toBe(1);
    expect(await screen.findByRole('img', { name: '0 mastered, 0 learning, 2 not studied' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set options' })).toHaveFocus();
  });

  it('keeps the set when the delete confirmation is cancelled', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const { user } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Set options' }));
    await user.click(screen.getByRole('button', { name: 'Delete set' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete set' })).toBeInTheDocument();
    expect(await db.sets.count()).toBe(1);
  });

  it('links Edit set to the editor and Back to Home', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const { user, router } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Set options' }));
    expect(screen.getByRole('link', { name: 'Edit set' })).toHaveAttribute('href', `/sets/${id}/edit`);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('SetPage modes and list', () => {
  it('enables Learn with two cards and disables both modes when the set is empty', async () => {
    const two = await createSet({ title: 'Two', definitionLang: 'sk', cards: [{ term: 'a', definition: 'b' }, { term: 'c', definition: 'd' }] });
    const empty = await createSet({ title: 'Empty', definitionLang: 'sk', cards: [] });
    const view = renderRoute(`/sets/${two}`);
    expect(await screen.findByRole('link', { name: /Learn/ })).toHaveAttribute('href', `/sets/${two}/learn`);
    view.unmount();
    renderRoute(`/sets/${empty}`);
    expect(await screen.findByRole('heading', { name: 'Empty' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Flashcards/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Learn/ })).not.toBeInTheDocument();
  });

  it('stars only the tapped term and un-stars it on a second tap', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }, { term: 'delay', definition: 'meškanie' }] });
    const { user } = renderRoute(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Star delay' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Star delay' })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('button', { name: 'Star gate' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Star delay' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Star delay' })).toHaveAttribute('aria-pressed', 'false'));
  });

  it('previews at most 10 cards', async () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ term: `w${i}`, definition: `d${i}` }));
    const id = await createSet({ title: 'Big', definitionLang: 'sk', cards });
    renderRoute(`/sets/${id}`);
    const preview = await screen.findByLabelText('Card preview');
    expect(preview.children).toHaveLength(10);
    expect(within(preview).queryByText('w10')).not.toBeInTheDocument();
    expect(screen.getByText('12 terms · English → Slovak')).toBeInTheDocument();
  });

  it('exposes the card preview strip as a labelled group of the set terms', async () => {
    const id = await createSet({
      title: 'T',
      definitionLang: 'sk',
      cards: [
        { term: 'gate', definition: 'brána' },
        { term: 'delay', definition: 'meškanie' },
      ],
    });
    renderRoute(`/sets/${id}`);
    const preview = await screen.findByRole('group', { name: 'Card preview' });
    expect(within(preview).getByText('gate')).toBeInTheDocument();
    expect(within(preview).getByText('delay')).toBeInTheDocument();
  });
});
