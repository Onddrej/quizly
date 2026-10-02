import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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
