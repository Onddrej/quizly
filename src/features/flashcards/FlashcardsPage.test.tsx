import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { createSet } from '../../db/sets';
import { saveSetting } from '../../db/settings';
import { DEFAULT_SETTINGS } from '../../db/types';

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

const detailed = {
  term: 'departure',
  definition: 'odchod, odlet',
  meaning: 'the act of leaving a place',
  examples: 'The departure was delayed.\nHe waved at her departure.',
};

async function openDeck(deck: { term: string; definition: string; meaning?: string; examples?: string }[], definitionFirst = false) {
  const id = await createSet({ title: 'T', definitionLang: 'sk', cards: deck });
  if (definitionFirst) await saveSetting('flashcards', { ...DEFAULT_SETTINGS.flashcards, startWithDefinition: true });
  const view = renderRoute(`/sets/${id}/flashcards`);
  await screen.findByRole('heading', { name: `1 / ${deck.length}` });
  return view;
}

/** The card face (the aria-hidden toggled block) that holds `text`. */
const faceOf = (text: string) => screen.getByText(text).closest('[aria-hidden]') as HTMLElement;

describe('FlashcardsPage card details', () => {
  it('shows translation, definition and examples on the back face when the card has them', async () => {
    const { user } = await openDeck([detailed]);
    const back = faceOf('odchod, odlet');
    expect(back).toHaveAttribute('aria-hidden', 'true');
    expect(within(back).getByText('odchod, odlet')).toHaveAttribute('lang', 'sk');
    expect(within(back).getByText('the act of leaving a place')).toHaveAttribute('lang', 'en');
    const examples = within(back).getAllByRole('listitem', { hidden: true });
    expect(examples.map((li) => li.textContent)).toEqual(['The departure was delayed.', 'He waved at her departure.']);
    expect(within(back).getByText('Slovak')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Flip card' }));
    expect(back).toHaveAttribute('aria-hidden', 'false');
    expect(within(back).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows translation, definition and examples on the front face when Start with definition is on', async () => {
    await openDeck([detailed], true);
    const front = faceOf('odchod, odlet');
    expect(front).toHaveAttribute('aria-hidden', 'false');
    expect(within(front).getByText('odchod, odlet')).toHaveAttribute('lang', 'sk');
    expect(within(front).getByText('the act of leaving a place')).toHaveAttribute('lang', 'en');
    expect(within(front).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The departure was delayed.',
      'He waved at her departure.',
    ]);
    expect(within(front).getByText('Slovak')).toBeInTheDocument();
    expect(within(front).getByRole('button', { name: 'Star departure' })).toBeInTheDocument();
    expect(faceOf('departure')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    [false, 'SlovakbránaTap to flip back'],
    [true, 'SlovakbránaTap to flip'],
  ])('a card without details shows just the translation (definition first: %s)', async (definitionFirst, text) => {
    await openDeck([{ term: 'gate', definition: 'brána' }], definitionFirst);
    const face = faceOf('brána');
    expect(face.textContent).toBe(text);
    expect(within(face).queryAllByRole('listitem', { hidden: true })).toHaveLength(0);
    expect(face.querySelectorAll('p')).toHaveLength(1);
  });

  it.each([
    [false, 'departureTap to flip'],
    [true, 'departureTap to flip back'],
  ])('the term side shows only the term (definition first: %s)', async (definitionFirst, text) => {
    await openDeck([detailed], definitionFirst);
    const face = faceOf('departure');
    expect(face.textContent).toBe(text);
    expect(within(face).getByText('departure')).toHaveAttribute('lang', 'en');
    expect(within(face).queryAllByRole('listitem', { hidden: true })).toHaveLength(0);
  });

  it('keeps counters, sorting and the deck summary working for cards with details', async () => {
    const { user } = await openDeck([detailed, { term: 'gate', definition: 'brána' }]);
    await user.click(screen.getByRole('button', { name: 'Flip card' }));
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 / 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flip card' })).toBeInTheDocument();
    expect(faceOf('gate')).toHaveAttribute('aria-hidden', 'false');
    await user.click(screen.getByRole('button', { name: 'Undo last card' }));
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(faceOf('departure')).toHaveAttribute('aria-hidden', 'false');
    await user.click(screen.getByRole('button', { name: 'Still learning' }));
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    expect(screen.getByText('You know 1 · Still learning 1')).toBeInTheDocument();
  });

  it('does not carry the scroll position of the answer block over to the next card', async () => {
    const { user } = await openDeck([detailed, { term: 'gate', definition: 'brána' }], true);
    const scroller = screen.getByText('odchod, odlet').parentElement as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    expect(screen.getByText('brána').parentElement).not.toBe(scroller);
    expect(scroller.isConnected).toBe(false);
  });
});

describe('FlashcardsPage gestures on tall card content', () => {
  type User = ReturnType<typeof renderRoute>['user'];
  type Point = [number, number];
  const at = ([clientX, clientY]: Point) => ({ clientX, clientY });
  /** Presses on `target`, drags to `to` and (unless `release` is false) lets go there. */
  const drag = async (user: User, target: Element, from: Point, to: Point, release = true) => {
    await user.pointer([{ keys: '[MouseLeft>]', target, coords: at(from) }, { coords: at(to) }]);
    if (release) await user.pointer({ keys: '[/MouseLeft]' });
  };
  const tall = () => screen.getByText('the act of leaving a place');
  const notFlipped = () => screen.getByRole('button', { name: 'Flip card' });
  const deck = [detailed, { term: 'gate', definition: 'brána' }];

  it('a tap on the content flips the card and a second tap flips it back', async () => {
    const { user } = await openDeck(deck, true);
    await drag(user, tall(), [150, 200], [152, 203]);
    expect(screen.getByRole('button', { name: 'Show front of card' })).toBeInTheDocument();
    await drag(user, tall(), [150, 200], [150, 200]);
    expect(notFlipped()).toBeInTheDocument();
  });

  it('a vertical drag over the content (scrolling it) neither flips nor sorts the card', async () => {
    const { user } = await openDeck(deck, true);
    await drag(user, tall(), [150, 300], [158, 180], false);
    expect(notFlipped().style.transform).toBe('');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(notFlipped()).toBeInTheDocument();
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Still learning: 0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 / 2' })).toBeInTheDocument();
  });

  it('a mostly vertical diagonal drag is a scroll too, not a swipe', async () => {
    const { user } = await openDeck(deck, true);
    await drag(user, tall(), [100, 100], [200, 320]);
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(notFlipped()).toBeInTheDocument();
  });

  it('a gesture the browser takes over for scrolling (pointercancel) does nothing and releases the card', async () => {
    const { user } = await openDeck(deck, true);
    await drag(user, tall(), [150, 300], [190, 310], false);
    expect(notFlipped().style.transform).not.toBe('');
    fireEvent.pointerCancel(tall(), { pointerId: 1 });
    expect(notFlipped().style.transform).toBe('');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(notFlipped()).toBeInTheDocument();
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Still learning: 0')).toBeInTheDocument();
  });

  it('swiping right on the content sorts the card as known and swiping left as still learning', async () => {
    const { user } = await openDeck([...deck, { term: 'delay', definition: 'meškanie' }], true);
    await drag(user, tall(), [100, 200], [230, 210]);
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 / 3' })).toBeInTheDocument();
    await drag(user, screen.getByText('brána'), [230, 200], [100, 205]);
    expect(screen.getByLabelText('Still learning: 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 / 3' })).toBeInTheDocument();
    expect(notFlipped()).toBeInTheDocument();
  });

  it('a short horizontal drag does neither', async () => {
    const { user } = await openDeck(deck, true);
    await drag(user, tall(), [100, 200], [150, 200]);
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Still learning: 0')).toBeInTheDocument();
    expect(notFlipped()).toBeInTheDocument();
  });
});

describe('FlashcardsPage keyboard, focus and the flip', () => {
  const deck = [
    { term: 'gate', definition: 'brána' },
    { term: 'delay', definition: 'meškanie' },
  ];
  const cardButton = (name: 'Flip card' | 'Show front of card' = 'Flip card') => screen.getByRole('button', { name });
  /** The element that turns (the two faces live in it). */
  const turning = () => screen.getByRole('button', { name: /^(Flip card|Show front of card)$/ }).firstElementChild as HTMLElement;

  it('Space and Enter on the card flip it', async () => {
    const { user } = await openDeck(deck);
    cardButton().focus();
    await user.keyboard(' ');
    expect(cardButton('Show front of card')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(cardButton()).toBeInTheDocument();
  });

  it('Enter on the Star button toggles the star and does not flip the card', async () => {
    const { user } = await openDeck(deck);
    screen.getByRole('button', { name: 'Star gate' }).focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Star gate' })).toHaveAttribute('aria-pressed', 'true'));
    expect(cardButton()).toBeInTheDocument();
  });

  it.each(['Alt', 'Control', 'Meta'])('arrow keys with %s held are browser shortcuts and do not sort', async (modifier) => {
    const { user } = await openDeck(deck);
    await user.keyboard(`{${modifier}>}{ArrowLeft}{ArrowRight}{/${modifier}}`);
    expect(screen.getByLabelText('Still learning: 0')).toBeInTheDocument();
    expect(screen.getByLabelText('Know: 0')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 / 2' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
  });

  it('makes the face turned away inert so its buttons cannot be focused, and swaps on flip', async () => {
    const { user } = await openDeck(deck);
    const front = faceOf('gate');
    const back = faceOf('brána');
    expect(front).not.toHaveAttribute('inert');
    expect(back).toHaveAttribute('inert');
    await user.click(cardButton());
    expect(front).toHaveAttribute('inert');
    expect(back).not.toHaveAttribute('inert');
  });

  it('keeps the same turning element for a flip so it animates, and mounts a fresh one per card so the next answer never flashes', async () => {
    const { user } = await openDeck(deck);
    const first = turning();
    await user.click(cardButton());
    expect(turning()).toBe(first);
    await user.click(screen.getByRole('button', { name: 'Know it' }));
    const second = turning();
    expect(second).not.toBe(first);
    expect(cardButton()).toBeInTheDocument();
    await user.click(cardButton());
    expect(turning()).toBe(second);
    await user.click(screen.getByRole('button', { name: 'Undo last card' }));
    expect(turning()).not.toBe(second);
    expect(cardButton()).toBeInTheDocument();
  });
});
