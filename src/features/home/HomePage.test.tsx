import { beforeEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { completeRound, createSet, markStudied } from '../../db/sets';
import { listCards, setCardStage } from '../../db/cards';

const cards = [{ term: 'gate', definition: 'brána' }];
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ term: `t${i}`, definition: `d${i}` }));

async function stages(setId: string, values: Array<0 | 1 | 2 | 3 | 4>) {
  const list = await listCards(setId);
  for (let i = 0; i < values.length; i++) await setCardStage(list[i].id, values[i], 5000);
}

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

  it('resume card shows title, term count, mode chip, progress and round', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: many(5) }, 1000);
    await stages(id, [4, 4, 1, 2, 0]);
    await completeRound(id);
    await completeRound(id);
    await markStudied(id, 3000);
    renderRoute('/');
    const heading = await screen.findByRole('heading', { name: 'Jump back in' });
    const card = heading.closest('section')!;
    expect(within(card).getByText('Travel')).toBeInTheDocument();
    expect(within(card).getByText('5 terms')).toBeInTheDocument();
    expect(within(card).getByText('Learn')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: '2 mastered, 2 learning, 1 not studied' })).toBeInTheDocument();
    expect(within(card).getByText('2 mastered · 2 learning · round 3')).toBeInTheDocument();
  });

  it('describes sets: plural, singular, not started, learning without mastered', async () => {
    await createSet({ title: 'A', definitionLang: 'sk', cards }, 1);
    const b = await createSet({ title: 'B', definitionLang: 'sk', cards: many(2) }, 2);
    const c = await createSet({ title: 'C', definitionLang: 'sk', cards: many(3) }, 3);
    await stages(b, [4, 4]);
    await stages(c, [1, 0, 0]);
    renderRoute('/');
    await screen.findByRole('heading', { name: 'Your sets' });
    const rows = screen.getAllByRole('link', { name: /^[ABC] [0-9]/ });
    expect(rows.map((r) => r.textContent)).toEqual(['C3 terms · 0 mastered', 'B2 terms · 2 mastered', 'A1 term · not started']);
  });

  it('has no search button while there are no sets', async () => {
    renderRoute('/');
    await screen.findByText('Create your first set');
    expect(screen.queryByRole('button', { name: 'Search sets' })).not.toBeInTheDocument();
  });

  it('shows no "Jump back in" section when no set was studied', async () => {
    await createSet({ title: 'A', definitionLang: 'sk', cards });
    renderRoute('/');
    await screen.findByRole('heading', { name: 'Your sets' });
    expect(screen.queryByRole('heading', { name: 'Jump back in' })).not.toBeInTheDocument();
  });

  it('search: focuses the input, is case-insensitive, hides resume, shows no-match text, close clears', async () => {
    const t = await createSet({ title: 'Travel', definitionLang: 'sk', cards }, 1000);
    await createSet({ title: 'Kitchen', definitionLang: 'sk', cards }, 2000);
    await markStudied(t, 3000);
    const { user } = renderRoute('/');
    await user.click(await screen.findByRole('button', { name: 'Search sets' }));
    const box = screen.getByRole('searchbox', { name: 'Search sets' });
    expect(box).toHaveFocus();
    await user.type(box, 'KIT');
    expect(screen.queryByRole('heading', { name: 'Jump back in' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Kitchen/ })).toBeInTheDocument();
    await user.clear(box);
    await user.type(box, 'zzz');
    expect(screen.getByText('No sets match “zzz”.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Jump back in' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^(Travel|Kitchen)/ })).toHaveLength(2);
    // reopening starts with an empty query
    await user.click(screen.getByRole('button', { name: 'Search sets' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('updates live when another set is studied', async () => {
    const a = await createSet({ title: 'Alpha', definitionLang: 'sk', cards }, 1000);
    const b = await createSet({ title: 'Beta', definitionLang: 'sk', cards }, 2000);
    await markStudied(a, 3000);
    renderRoute('/');
    const heading = await screen.findByRole('heading', { name: 'Jump back in' });
    expect(within(heading.closest('section')!).getByText('Alpha')).toBeInTheDocument();
    await act(async () => {
      await markStudied(b, 4000);
    });
    await waitFor(() =>
      expect(within(screen.getByRole('heading', { name: 'Jump back in' }).closest('section')!).getByText('Beta')).toBeInTheDocument(),
    );
    expect(screen.getAllByRole('link', { name: /^(Alpha|Beta)/ }).map((r) => r.textContent?.slice(0, 5))).toEqual(['Beta1', 'Alpha']);
  });

  it('sorts a studied set by its last study time even if another set was created later', async () => {
    const old = await createSet({ title: 'Old', definitionLang: 'sk', cards }, 1000);
    await createSet({ title: 'Fresh', definitionLang: 'sk', cards }, 5000);
    await markStudied(old, 4000);
    renderRoute('/');
    const rows = await screen.findAllByRole('link', { name: /^(Old|Fresh)/ });
    expect(rows.map((r) => r.textContent?.slice(0, 5))).toEqual(['Fresh', 'Old1 ']);
  });

  it('does not flash the empty state while the live query is pending', async () => {
    await createSet({ title: 'A', definitionLang: 'sk', cards });
    renderRoute('/');
    expect(screen.queryByText('Create your first set')).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Your sets' });
    expect(screen.queryByText('Create your first set')).not.toBeInTheDocument();
  });
});
