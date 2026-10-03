import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import { listCards, setCardStage } from '../../db/cards';

beforeEach(resetDb);

// pasting keeps longer values from re-rendering the whole page once per keystroke
const fill = async (user: UserEvent, field: HTMLElement, text: string) => {
  await user.click(field);
  await user.paste(text);
};

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

  it('shows an error for a card without a translation and saves nothing', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'T');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Add a translation')).toBeInTheDocument();
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

describe('SetEditorPage vocabulary', () => {
  it('calls the main field Translation and explains the paste format with it', async () => {
    renderRoute('/create');
    await screen.findByLabelText('Title');
    expect(screen.getAllByLabelText('Translation')).toHaveLength(2);
    expect(screen.getByLabelText('Translation language')).toHaveValue('sk');
    expect(
      screen.getByText('One pair per line. Separate term and translation with a dash, tab or comma.'),
    ).toBeInTheDocument();
  });
});

describe('SetEditorPage card details', () => {
  const OPEN = { name: 'Add definition and examples' };
  const aSet = (cards: { term: string; definition: string; meaning?: string; examples?: string }[]) =>
    createSet({ title: 'Airport', definitionLang: 'sk', cards });

  it('opens and closes the definition and examples panel of a new card', async () => {
    const { user } = renderRoute('/create');
    await screen.findByLabelText('Title');
    const toggle = screen.getAllByRole('button', OPEN)[0];
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Definition')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Examples')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    const meaning = screen.getByLabelText('Definition');
    const examples = screen.getByLabelText('Examples');
    expect(panel).toContainElement(meaning);
    expect(panel).toContainElement(examples);
    expect(meaning).toHaveAttribute('lang', 'en');
    expect(examples).toHaveAttribute('lang', 'en');
    expect(examples).toHaveAccessibleDescription('One or two sentences, one per line.');
    // the other new card stays closed
    expect(screen.getAllByRole('button', OPEN)[1]).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Definition')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Examples')).not.toBeInTheDocument();
  });

  it('saves the definition and examples with the card', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Airport');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.type(screen.getAllByLabelText('Translation')[0], 'brána');
    await user.click(screen.getAllByRole('button', OPEN)[0]);
    await fill(user, screen.getByLabelText('Definition'), 'a door at an airport');
    await fill(user, screen.getByLabelText('Examples'), 'Gate 12 is open.\nPlease go to the gate.');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Airport' });
    const [card] = await db.cards.toArray();
    expect(card).toMatchObject({
      term: 'gate',
      definition: 'brána',
      meaning: 'a door at an airport',
      examples: 'Gate 12 is open.\nPlease go to the gate.',
    });
  });

  it('does not store empty or blank details', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Airport');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.type(screen.getAllByLabelText('Translation')[0], 'brána');
    await user.click(screen.getAllByRole('button', OPEN)[0]);
    await fill(user, screen.getByLabelText('Definition'), '   ');
    await fill(user, screen.getByLabelText('Examples'), '\n \n');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Airport' });
    const [card] = await db.cards.toArray();
    expect(Object.keys(card)).not.toContain('meaning');
    expect(Object.keys(card)).not.toContain('examples');
  });

  it('opens the panel of an existing card that has details and shows their text', async () => {
    const id = await aSet([
      { term: 'gate', definition: 'brána', meaning: 'a door at an airport', examples: 'Gate 12 is open.\nPlease go to the gate.' },
      { term: 'delay', definition: 'meškanie' },
    ]);
    renderRoute(`/sets/${id}/edit`);
    await screen.findByDisplayValue('gate');
    const [withDetails, without] = screen.getAllByRole('button', { name: /definition and examples/ });
    expect(withDetails).toHaveAttribute('aria-expanded', 'true');
    expect(without).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Definition')).toHaveValue('a door at an airport');
    expect(screen.getByLabelText('Examples')).toHaveValue('Gate 12 is open.\nPlease go to the gate.');
  });

  it('opens the panel for a card with only examples too', async () => {
    const id = await aSet([{ term: 'gate', definition: 'brána', examples: 'Gate 12 is open.' }]);
    renderRoute(`/sets/${id}/edit`);
    await screen.findByDisplayValue('gate');
    expect(screen.getByRole('button', { name: /definition and examples/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Definition')).toHaveValue('');
    expect(screen.getByLabelText('Examples')).toHaveValue('Gate 12 is open.');
  });

  it.each([
    ['Definition', 'meaning', 'examples'],
    ['Examples', 'examples', 'meaning'],
  ] as const)('removes the stored %s when the field is cleared and keeps the other', async (label, cleared, kept) => {
    const id = await aSet([{ term: 'gate', definition: 'brána', meaning: 'a door', examples: 'Gate 12 is open.' }]);
    const [card] = await listCards(id);
    await setCardStage(card.id, 2);
    const { user } = renderRoute(`/sets/${id}/edit`);
    await user.clear(await screen.findByLabelText(label));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Airport' });
    const stored = await db.cards.get(card.id);
    expect(Object.keys(stored ?? {})).not.toContain(cleared);
    expect(stored).toHaveProperty(kept);
    expect(stored).toMatchObject({ term: 'gate', definition: 'brána', stage: 2 });
  });

  it('keeps the details of an existing card when only its term changes', async () => {
    const id = await aSet([{ term: 'gate', definition: 'brána', meaning: 'a door', examples: 'Gate 12 is open.' }]);
    const [card] = await listCards(id);
    const { user } = renderRoute(`/sets/${id}/edit`);
    const term = await screen.findByDisplayValue('gate');
    await user.clear(term);
    await user.type(term, 'gates');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Airport' });
    expect(await db.cards.get(card.id)).toMatchObject({ term: 'gates', meaning: 'a door', examples: 'Gate 12 is open.' });
  });

  it('shows the term and translation errors for a card that only has a definition', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Airport');
    await user.click(screen.getAllByRole('button', OPEN)[0]);
    await fill(user, screen.getByLabelText('Definition'), 'a door at an airport');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Add a term')).toBeInTheDocument();
    expect(screen.getByText('Add a translation')).toBeInTheDocument();
    expect(await db.sets.count()).toBe(0);
  });

  it('keeps the text when the panel is closed, renames the toggle, and still saves it', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Airport');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.type(screen.getAllByLabelText('Translation')[0], 'brána');
    const toggle = screen.getAllByRole('button', OPEN)[0];
    await user.click(toggle);
    await fill(user, screen.getByLabelText('Definition'), 'a door at an airport');
    await fill(user, screen.getByLabelText('Examples'), 'Gate 12 is open.');
    await user.click(toggle);

    expect(screen.queryByLabelText('Definition')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Edit definition and examples');

    await user.click(toggle);
    expect(screen.getByLabelText('Definition')).toHaveValue('a door at an airport');
    expect(screen.getByLabelText('Examples')).toHaveValue('Gate 12 is open.');
    await user.click(toggle);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'Airport' });
    expect(await db.cards.toArray()).toMatchObject([
      { term: 'gate', definition: 'brána', meaning: 'a door at an airport', examples: 'Gate 12 is open.' },
    ]);
  });

  it('keeps a card that only has a definition when a list is pasted', async () => {
    const { user } = renderRoute('/create');
    await screen.findByLabelText('Title');
    await user.click(screen.getAllByRole('button', OPEN)[0]);
    await fill(user, screen.getByLabelText('Definition'), 'a door at an airport');
    await user.click(screen.getByLabelText(/One pair per line/));
    await user.paste('layover - prestup');
    await user.click(screen.getByRole('button', { name: 'Add 1 card' }));
    expect(screen.getByLabelText('Definition')).toHaveValue('a door at an airport');
    expect(screen.getByDisplayValue('layover')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Term')).toHaveLength(2);
  });
});

describe('SetEditorPage leaving and saving', () => {
  it('shows the not-found page for an unknown set', async () => {
    renderRoute('/sets/nope/edit');
    expect(await screen.findByText("This set doesn't exist")).toBeInTheDocument();
  });

  it('removes a deleted card together with its progress on save, and keeps the other card', async () => {
    const id = await createSet({
      title: 'T',
      definitionLang: 'sk',
      cards: [
        { term: 'gate', definition: 'brána' },
        { term: 'delay', definition: 'meškanie' },
      ],
    });
    const [first, second] = await listCards(id);
    await setCardStage(first.id, 3);
    await setCardStage(second.id, 2);
    const { user } = renderRoute(`/sets/${id}/edit`);
    await screen.findByDisplayValue('gate');
    await user.click(screen.getByRole('button', { name: 'Delete card 1' }));
    expect(screen.queryByDisplayValue('gate')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete card 1' })).toBeInTheDocument(); // numbering closes up
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'T' });
    expect(await db.cards.get(first.id)).toBeUndefined();
    expect(await db.cards.get(second.id)).toMatchObject({ term: 'delay', stage: 2 });
  });

  it('Keep editing dismisses the prompt, stays on the page and keeps the changes', async () => {
    const { user, router } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/create');
    expect(screen.getByLabelText('Title')).toHaveValue('Draft');
  });

  it('closes without a prompt when nothing was changed', async () => {
    const { user } = renderRoute('/create');
    await screen.findByLabelText('Title');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Create your first set')).toBeInTheDocument();
  });

  it('toasts and stays when saving fails, and Save works again', async () => {
    const { user, router } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'T');
    await fill(user, screen.getAllByLabelText('Term')[0], 'gate');
    await fill(user, screen.getAllByLabelText('Translation')[0], 'brána');
    const spy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('disk full'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/create');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    spy.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('heading', { name: 'T' });
    expect(await db.sets.count()).toBe(1);
  });

  it('creates only one set when Save is tapped twice while saving', async () => {
    const { user } = renderRoute('/create');
    await user.type(await screen.findByLabelText('Title'), 'T');
    await fill(user, screen.getAllByLabelText('Term')[0], 'gate');
    await fill(user, screen.getAllByLabelText('Translation')[0], 'brána');
    const real = db.transaction.bind(db) as (...args: unknown[]) => Promise<unknown>;
    const spy = vi
      .spyOn(db, 'transaction')
      .mockImplementation(((...args: unknown[]) => new Promise((resolve) => setTimeout(resolve, 100)).then(() => real(...args))) as never);
    const save = screen.getByRole('button', { name: 'Save' });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    await screen.findByRole('heading', { name: 'T' });
    spy.mockRestore();
    await waitFor(async () => expect(await db.sets.count()).toBe(1));
  });
});
