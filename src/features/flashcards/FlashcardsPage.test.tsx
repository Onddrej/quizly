import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { createSet } from '../../db/sets';

const cards = [
  { term: 'gate', definition: 'brána' },
  { term: 'delay', definition: 'meškanie' },
  { term: 'customs', definition: 'colnica' },
];

beforeEach(resetDb);

describe('FlashcardsPage', () => {
  it('sorting a card updates the counters and Undo reverts it', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards });
    const { user } = renderRoute(`/sets/${id}/flashcards`);
    expect(await screen.findByRole('heading', { name: '1 / 3' })).toBeInTheDocument();
    expect(screen.getByText('gate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 / 3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo last card' }));
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
  });

  it('shows the summary after the last card and restarts the still-learning ones', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards });
    const { user } = renderRoute(`/sets/${id}/flashcards`);
    await screen.findByRole('heading', { name: '1 / 3' });
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    await user.click(screen.getByRole('button', { name: 'Still learning' }));
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    expect(screen.getByRole('heading', { name: 'Deck finished' })).toBeInTheDocument();
    expect(screen.getByText('You know 2 · Still learning 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Study 1 again' }));
    expect(screen.getByRole('heading', { name: '1 / 1' })).toBeInTheDocument();
    expect(screen.getByText('delay')).toBeInTheDocument();
  });

  it('arrow keys sort cards', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards });
    const { user } = renderRoute(`/sets/${id}/flashcards`);
    await screen.findByRole('heading', { name: '1 / 3' });
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByLabelText('Still learning: 1')).toBeInTheDocument();
  });
});
