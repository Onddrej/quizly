import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import { listCards, setCardStage } from '../../db/cards';

beforeEach(resetDb);

describe('SetEditorPage', () => {
  it('creates a set from a pasted list', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Travel');
    await user.click(screen.getByLabelText(/One pair per line/));
    await user.paste('gate - brána\nlayover - prestup\ncheck-in desk - odbavovacia prepážka');
    await user.click(screen.getByRole('button', { name: 'Add 3 cards' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Travel' })).toBeInTheDocument();
    const [set] = await db.sets.toArray();
    expect((await listCards(set.id)).map((c) => c.term)).toEqual(['gate', 'layover', 'check-in desk']);
  });

  it('lists pasted lines that cannot be split', async () => {
    const { user } = renderRoute('/create');
    await user.click(await screen.findByLabelText(/One pair per line/));
    await user.paste('gate - brána\nnope');
    expect(screen.getByText('Line 2: no separator found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 1 card' })).toBeInTheDocument();
  });

  it('shows an error for a card without a definition and saves nothing', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'T');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Add a definition')).toBeInTheDocument();
    expect(await db.sets.count()).toBe(0);
  });

  it('keeps progress when an existing card is edited', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const [card] = await listCards(id);
    await setCardStage(card.id, 3);
    const { user } = renderRoute(`/sets/${id}/edit`);
    const term = await screen.findByDisplayValue('gate');
    await user.clear(term);
    await user.type(term, 'gates');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'T' });
    expect(await db.cards.get(card.id)).toMatchObject({ term: 'gates', stage: 3 });
  });

  it('asks before discarding unsaved changes', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(await screen.findByText('Create your first set')).toBeInTheDocument();
  });
});
