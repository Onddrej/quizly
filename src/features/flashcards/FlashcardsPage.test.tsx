import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import { saveSetting } from '../../db/settings';
import { DEFAULT_SETTINGS } from '../../db/types';
import { collectUnhandledRejections } from '../../test/unhandled';

// A fixed "shuffle" (reverse order) so the tests can see what Shuffle does to the cards still to come.
vi.mock('../../lib/random', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/random')>()),
  shuffle: <T,>(items: readonly T[]) => items.slice().reverse(),
}));

// Records the title of every top bar render, to see frames the user could catch (such as "0 / 0").
const titles = vi.hoisted(() => [] as string[]);
vi.mock('../../ui/TopBar', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../ui/TopBar')>();
  return {
    ...real,
    TopBar: (props: ComponentProps<typeof real.TopBar>) => {
      if (typeof props.title === 'string') titles.push(props.title);
      return real.TopBar(props);
    },
  };
});

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

describe('FlashcardsPage failed writes', () => {
  const twoCards = [
    { term: 'gate', definition: 'brána' },
    { term: 'delay', definition: 'meškanie' },
  ];

  it('toasts when starring the card fails', async () => {
    const { user } = await openDeck(twoCards);
    const spy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('disk full'));
    try {
      await user.click(screen.getByRole('button', { name: 'Star gate' }));
      expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('toasts when saving a flashcard option fails', async () => {
    const { user } = await openDeck(twoCards);
    await user.click(screen.getByRole('button', { name: 'Flashcard options' }));
    const sw = screen.getByRole('switch', { name: 'Start with definition' });
    const spy = vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('quota'));
    try {
      await user.click(sw);
      expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });

  it('swallows a failed last-studied stamp: no toast, no unhandled rejection', async () => {
    const unhandled = collectUnhandledRejections();
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: twoCards });
    const spy = vi.spyOn(db.sets, 'update').mockRejectedValue(new Error('boom'));
    try {
      renderRoute(`/sets/${id}/flashcards`);
      await screen.findByRole('heading', { name: '1 / 2' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(spy).toHaveBeenCalled();
      expect(screen.queryByText("Couldn't save. Try again.")).not.toBeInTheDocument();
      expect(unhandled.reasons).toEqual([]);
    } finally {
      spy.mockRestore();
      unhandled.stop();
    }
  });
});

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

describe('FlashcardsPage shuffle, finish and empty deck', () => {
  beforeEach(() => {
    titles.length = 0;
  });
  const five = [
    { term: 'alpha', definition: 'a1' },
    { term: 'bravo', definition: 'b2' },
    { term: 'charlie', definition: 'c3' },
    { term: 'delta', definition: 'd4' },
    { term: 'echo', definition: 'e5' },
  ];
  const click = (user: Awaited<ReturnType<typeof openDeck>>['user'], name: string) => user.click(screen.getByRole('button', { name }));

  it('toggling Shuffle mid-pass keeps the sorted cards, the counters and the card on screen', async () => {
    const { user } = await openDeck(five);
    await click(user, 'Know it');
    await click(user, 'Still learning');
    expect(screen.getByRole('heading', { name: '3 / 5' })).toBeInTheDocument();
    await click(user, 'Shuffle');
    expect(screen.getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: '3 / 5' })).toBeInTheDocument();
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Still learning: 1')).toBeInTheDocument();
    expect(faceOf('charlie')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Know it'); // the rest comes shuffled (reversed here): echo before delta
    expect(screen.getByRole('heading', { name: '4 / 5' })).toBeInTheDocument();
    expect(faceOf('echo')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Shuffle'); // off: the rest goes back to the set order, the card on screen stays
    expect(screen.getByRole('button', { name: 'Shuffle' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: '4 / 5' })).toBeInTheDocument();
    expect(faceOf('echo')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Know it');
    expect(faceOf('delta')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Know it');
    expect(screen.getByText('You know 4 · Still learning 1')).toBeInTheDocument();
  });

  it('keeps a flipped card flipped when Shuffle is toggled', async () => {
    const { user } = await openDeck(five);
    await user.click(screen.getByRole('button', { name: 'Flip card' }));
    await click(user, 'Shuffle');
    expect(screen.getByRole('button', { name: 'Show front of card' })).toBeInTheDocument();
    expect(faceOf('alpha')).toHaveAttribute('aria-hidden', 'true');
  });

  it('Shuffle reorders only the cards still to come in a Study again pass', async () => {
    const { user } = await openDeck(five);
    await click(user, 'Still learning'); // alpha
    await click(user, 'Know it');
    await click(user, 'Still learning'); // charlie
    await click(user, 'Still learning'); // delta
    await click(user, 'Know it');
    await click(user, 'Study 3 again');
    expect(screen.getByRole('heading', { name: '1 / 3' })).toBeInTheDocument();
    await click(user, 'Know it');
    await click(user, 'Shuffle'); // only charlie (on screen) and delta are left of this pass of 3; the pass is not widened to the deck
    expect(screen.getByRole('heading', { name: '2 / 3' })).toBeInTheDocument();
    expect(faceOf('charlie')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Know it');
    expect(screen.getByRole('heading', { name: '3 / 3' })).toBeInTheDocument();
    expect(faceOf('delta')).toHaveAttribute('aria-hidden', 'false');
  });

  it('Restart all and Study again still restart with the current shuffle setting', async () => {
    const { user } = await openDeck(five.slice(0, 3));
    await click(user, 'Shuffle'); // on: alpha stays on screen, the rest comes reversed (charlie, bravo)
    await click(user, 'Still learning');
    await click(user, 'Know it');
    await click(user, 'Know it');
    expect(screen.getByRole('heading', { name: 'Deck finished' })).toBeInTheDocument();
    await click(user, 'Restart all'); // shuffle is on: a fresh shuffle of the whole deck (reversed): charlie, bravo, alpha
    expect(screen.getByRole('heading', { name: '1 / 3' })).toBeInTheDocument();
    expect(faceOf('charlie')).toHaveAttribute('aria-hidden', 'false');
  });

  it('the deck-finished screen can undo the last card', async () => {
    const { user } = await openDeck(cards);
    await click(user, 'Know it');
    await click(user, 'Still learning');
    await click(user, 'Know it');
    expect(screen.getByRole('heading', { name: 'Deck finished' })).toBeInTheDocument();
    expect(screen.getByText('You know 2 · Still learning 1')).toBeInTheDocument();
    await click(user, 'Undo last card');
    expect(screen.getByRole('heading', { name: '3 / 3' })).toBeInTheDocument();
    expect(screen.getByLabelText('Know: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Still learning: 1')).toBeInTheDocument();
    expect(faceOf('customs')).toHaveAttribute('aria-hidden', 'false');
    await click(user, 'Still learning');
    expect(screen.getByText('You know 1 · Still learning 2')).toBeInTheDocument();
  });

  it('shows a message and a way back for a set without cards', async () => {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [] });
    const { user, router } = renderRoute(`/sets/${id}/flashcards`);
    expect(await screen.findByText('No cards to study')).toBeInTheDocument();
    expect(screen.getByText('Add cards to this set or turn off Starred only.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /\d+ \/ \d+/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to set' }));
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('never renders a "0 / 0" frame while the deck is being set up', async () => {
    await openDeck(cards);
    expect(titles).toContain('1 / 3');
    expect(titles).not.toContain('0 / 0');
  });
});
