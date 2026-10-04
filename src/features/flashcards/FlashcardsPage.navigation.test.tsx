import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { resetNavigationTracking } from '../../app/navigation';
import { createSet } from '../../db/sets';

const cards = [
  { term: 'gate', definition: 'brána' },
  { term: 'delay', definition: 'meškanie' },
];

beforeEach(() => {
  resetNavigationTracking();
  return resetDb();
});

describe('FlashcardsPage leaving', () => {
  it('Close replaces the page with the set page instead of pushing history', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards });
    const { user, router } = renderRoute(`/sets/${id}/flashcards`);
    await screen.findByRole('heading', { name: '1 / 2' });
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('Back to set on the deck summary leaves without pushing history too', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards });
    const { user, router } = renderRoute(`/sets/${id}/flashcards`);
    await screen.findByRole('heading', { name: '1 / 2' });
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    await user.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
    expect(router.state.historyAction).toBe('REPLACE');
  });
});
