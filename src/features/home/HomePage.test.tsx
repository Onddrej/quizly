import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { createSet, markStudied } from '../../db/sets';

const cards = [{ term: 'gate', definition: 'brána' }];

beforeEach(resetDb);

describe('HomePage', () => {
  it('shows the empty state when there are no sets', async () => {
    renderRoute('/');
    expect(await screen.findByText('Create your first set')).toBeInTheDocument();
    // The tab bar's create button has the same accessible name, so look inside the page body only.
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Create set' })).toBeInTheDocument();
  });

  it('lists sets by last activity and offers to continue the last studied one', async () => {
    const travel = await createSet({ title: 'Travel', definitionLang: 'sk', cards }, 1000);
    await createSet({ title: 'Kitchen', definitionLang: 'sk', cards }, 2000);
    await markStudied(travel, 3000);
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Jump back in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue learning' })).toHaveAttribute('href', `/sets/${travel}/learn`);
    const rows = screen.getAllByRole('link', { name: /^(Travel|Kitchen)/ });
    expect(rows.map((r) => r.textContent)).toEqual(['Travel1 term · not started', 'Kitchen1 term · not started']);
  });

  it('filters sets by title', async () => {
    await createSet({ title: 'Travel', definitionLang: 'sk', cards });
    await createSet({ title: 'Kitchen', definitionLang: 'sk', cards });
    const { user } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Search sets' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search sets' }), 'kit');
    expect(screen.queryByRole('link', { name: /^Travel/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Kitchen/ })).toBeInTheDocument();
  });
});
