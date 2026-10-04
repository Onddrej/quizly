import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';
import type { Stage } from '../../db/types';

const pairs = { luggage: 'batožina', departure: 'odchod, odlet' } as const;
const typos: Record<string, string> = { luggage: 'lugage', departure: 'departre' };

async function setWithStage(stage: Stage, definitions: Record<string, string> = pairs) {
  const id = await createSet({
    title: 'Travel',
    definitionLang: 'sk',
    cards: Object.entries(definitions).map(([term, definition]) => ({ term, definition })),
  });
  await db.cards.where('setId').equals(id).modify({ stage });
  return id;
}

function shownTerm(): keyof typeof pairs {
  const el = screen.getByText(/^(luggage|departure)$/);
  return el.textContent as keyof typeof pairs;
}

function shownDefinitionTerm(): keyof typeof pairs {
  const el = screen.getByText(/^(batožina|odchod, odlet)$/);
  return el.textContent === 'batožina' ? 'luggage' : 'departure';
}

/** The round summary ignores taps for a moment after it appears (double-tap guard), so wait before using its buttons. */
const afterTapGuard = () => new Promise((resolve) => setTimeout(resolve, 400));

const cardOf = async (term: string) => (await db.cards.filter((c) => c.term === term).first())!;

beforeEach(resetDb);

describe('LearnPage', () => {
  it('a correct multiple choice answer moves the term to typing', async () => {
    const id = await setWithStage(0);
    const { user } = renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByText('Choose the matching translation')).toBeInTheDocument();
    const term = shownTerm();
    await user.click(screen.getByRole('button', { name: pairs[term] }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => {
      const card = await db.cards.filter((c) => c.term === term).first();
      expect(card?.stage).toBe(2);
    });
  });

  it('accepts a small typo when typing the English term', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the English term'), typos[shownDefinitionTerm()]);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct, small typo')).toBeInTheDocument();
  });

  it('accepts one comma-separated variant without diacritics when typing the translation', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const answer = shownTerm() === 'luggage' ? 'batozina' : 'odlet';
    await user.type(screen.getByLabelText('Type the translation in Slovak'), answer);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('This term is now mastered.')).toBeInTheDocument();
  });

  it('"I was right" counts a wrong typed answer as correct', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the English term'), 'baggage');
    const term = shownDefinitionTerm();
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I was right' }));
    expect(screen.getByText('Counted as correct')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => {
      const card = await db.cards.filter((c) => c.term === term).first();
      expect(card?.stage).toBe(3);
    });
  });

  it('shows the round summary and the completion screen', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    for (let i = 0; i < 2; i++) {
      // Continue saves asynchronously; wait for the next question's input instead of the old disabled one.
      await waitFor(() => expect(screen.getByLabelText('Type the translation in Slovak')).toBeEnabled());
      await user.type(screen.getByLabelText('Type the translation in Slovak'), shownTerm() === 'luggage' ? 'batožina' : 'odchod');
      await user.click(screen.getByRole('button', { name: 'Answer' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2 correct. 2 terms are now mastered.')).toBeInTheDocument();
    await afterTapGuard();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: "You've mastered all 2 terms" })).toBeInTheDocument();
  });
});

describe('LearnPage behavior', () => {
  it('"Don\'t know?" shows the answer without an "I was right" button and saves the lower stage and the answer time', async () => {
    const id = await setWithStage(3);
    const before = Date.now();
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const term = shownTerm();
    await user.click(screen.getByRole('button', { name: "Don't know?" }));
    expect(screen.getByText("Here's the answer")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'I was right' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect((await cardOf(term)).stage).toBe(2));
    expect((await cardOf(term)).lastAnsweredAt).toBeGreaterThanOrEqual(before);
  });

  it('a wrong multiple choice answer lowers the stage and the term comes back in the same round', async () => {
    const id = await setWithStage(0);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    const first = shownTerm();
    const wrong = pairs[first === 'luggage' ? 'departure' : 'luggage'];
    await user.click(screen.getByRole('button', { name: wrong }));
    expect(screen.getByText('Not quite')).toBeInTheDocument();
    expect(screen.getByText(/You'll see it again this round/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(shownTerm()).not.toBe(first));
    await user.click(screen.getByRole('button', { name: pairs[shownTerm()] }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(shownTerm()).toBe(first));
    expect(screen.getByRole('group').querySelectorAll('button')).toHaveLength(2);
    expect((await cardOf(first)).stage).toBe(1);
  });

  it('numbers the rounds: finishing round 1 saves learnRound 2 and the next round is titled Round 2', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    for (let i = 0; i < 2; i++) {
      await waitFor(() => expect(screen.getByLabelText('Type the English term')).toBeEnabled());
      await user.type(screen.getByLabelText('Type the English term'), shownDefinitionTerm());
      await user.click(screen.getByRole('button', { name: 'Answer' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument();
    await waitFor(async () => expect((await db.sets.get(id))?.learnRound).toBe(2));
    await afterTapGuard();
    await user.click(screen.getByRole('button', { name: 'Continue to round 2' }));
    expect(await screen.findByRole('heading', { name: 'Round 2' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Type the translation in Slovak')).toBeInTheDocument();
    expect((await db.sets.get(id))?.learnRound).toBe(2);
  });

  it('Study again resets every card and the round number', async () => {
    const id = await setWithStage(4);
    await db.sets.update(id, { learnRound: 5 });
    await db.cards.where('setId').equals(id).modify({ lastAnsweredAt: 123 });
    const { user } = renderRoute(`/sets/${id}/learn`);
    const studyAgain = await screen.findByRole('button', { name: 'Study again' });
    await afterTapGuard();
    await user.click(studyAgain);
    expect(await screen.findByRole('heading', { name: 'Round 1' })).toBeInTheDocument();
    expect(await screen.findByText('Choose the matching translation')).toBeInTheDocument();
    const cards = await db.cards.where('setId').equals(id).toArray();
    expect(cards.every((c) => c.stage === 0 && c.lastAnsweredAt === undefined)).toBe(true);
    expect((await db.sets.get(id))?.learnRound).toBe(1);
  });

  it('says "Any one of these is enough" when a comma-separated translation was missed', async () => {
    const id = await setWithStage(3, { luggage: 'batožina, kufor', departure: 'odchod, odlet' });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the translation in Slovak'), 'nonsense');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText(/Any one of these is enough/)).toBeInTheDocument();
  });

  it('Close returns to the set page', async () => {
    const id = await setWithStage(0);
    const { user, router } = renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
  });

  it('stays on the feedback and shows a toast when saving the answer fails, and Continue retries', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const term = shownTerm();
    const spy = vi.spyOn(db.cards, 'update').mockRejectedValue(new Error('boom'));
    try {
      await user.type(screen.getByLabelText('Type the translation in Slovak'), 'nonsense');
      await user.click(screen.getByRole('button', { name: 'Answer' }));
      expect(screen.getByText('Incorrect')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
      expect(screen.getByText('Incorrect')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect((await cardOf(term)).stage).toBe(3);
    } finally {
      spy.mockRestore();
    }
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect((await cardOf(term)).stage).toBe(2));
    await waitFor(() => expect(screen.queryByText('Incorrect')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Type the translation in Slovak')).toBeEnabled();
  });

  it('still shows the round summary, with a toast, when saving the finished round fails', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByLabelText('Type the translation in Slovak');
    const spy = vi.spyOn(db.sets, 'where').mockImplementation(() => {
      throw new Error('boom');
    });
    try {
      for (let i = 0; i < 2; i++) {
        await waitFor(() => expect(screen.getByLabelText('Type the translation in Slovak')).toBeEnabled());
        await user.type(screen.getByLabelText('Type the translation in Slovak'), shownTerm() === 'luggage' ? 'batožina' : 'odchod');
        await user.click(screen.getByRole('button', { name: 'Answer' }));
        await user.click(screen.getByRole('button', { name: 'Continue' }));
      }
      expect(await screen.findByRole('heading', { name: 'Round 1 done' })).toBeInTheDocument();
      expect(screen.getByText("Couldn't save. Try again.")).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('LearnPage edge cases', () => {
  const anyTerm = () => screen.getByText(/^(luggage|departure|gate)$/).textContent!;
  const three = { luggage: 'batožina', departure: 'odchod, odlet', gate: 'brána' };

  it('does not blank the page when the card being asked is deleted in another tab: with one card left it leaves for the set page', async () => {
    const id = await setWithStage(0);
    const { router } = renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    await db.cards.delete((await cardOf(shownTerm())).id);
    expect(await screen.findByRole('heading', { name: 'Travel' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
  });

  it('carries on with the remaining cards when the card being asked is deleted in another tab', async () => {
    const id = await setWithStage(0, three);
    renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    const deleted = anyTerm();
    await db.cards.delete((await cardOf(deleted)).id);
    await waitFor(() => expect(anyTerm()).not.toBe(deleted));
    const options = screen.getByRole('group').querySelectorAll('button');
    expect(options).toHaveLength(2);
    expect([...options].map((o) => o.textContent)).not.toContain(three[deleted as keyof typeof three]);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('keeps the correct answer among the options when the translation of the asked card is edited', async () => {
    const id = await setWithStage(0);
    const { user } = renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    const term = shownTerm();
    await db.cards.update((await cardOf(term)).id, { definition: 'novy preklad' });
    await user.click(await screen.findByRole('button', { name: 'novy preklad' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
  });

  it('does not reshuffle the options when another card changes', async () => {
    const id = await setWithStage(0, { luggage: 'batožina', departure: 'odchod, odlet', gate: 'brána', delay: 'meškanie', customs: 'colnica' });
    renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    const names = () => [...screen.getByRole('group').querySelectorAll('button')].map((b) => b.textContent);
    const before = names();
    expect(before).toHaveLength(4);
    const random = vi.spyOn(Math, 'random');
    try {
      const shown = screen.getByText(/^(luggage|departure|gate|delay|customs)$/).textContent;
      const other = await db.cards.filter((c) => c.term !== shown).first();
      await db.cards.update(other!.id, { starred: true });
      await waitFor(async () => expect((await db.cards.get(other!.id))?.starred).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(random).not.toHaveBeenCalled();
      expect(names()).toEqual(before);
    } finally {
      random.mockRestore();
    }
  });

  it('asks a typed question instead of a one-option multiple choice', async () => {
    const id = await setWithStage(0, { gate: 'brana', door: 'brana', port: 'brana' });
    const { user } = renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByLabelText('Type the English term')).toBeInTheDocument();
    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(screen.queryByText('Choose the matching translation')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "Don't know?" }));
    expect(screen.getByText("Here's the answer")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect((await db.cards.where('setId').equals(id).toArray()).some((c) => c.stage === 1)).toBe(true));
    // Continue saves asynchronously: wait until the old feedback is gone, so the input found next belongs to the next question.
    await waitFor(() => expect(screen.queryByText("Here's the answer")).not.toBeInTheDocument());
    expect(screen.getByLabelText('Type the English term')).toBeEnabled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('a correct typed answer to such a question moves the card on as in multiple choice', async () => {
    const id = await createSet({
      title: 'Same',
      definitionLang: 'sk',
      cards: [
        { term: 'door', definition: 'brana' },
        { term: 'door', definition: 'brana' },
      ],
    });
    const { user } = renderRoute(`/sets/${id}/learn`);
    await user.type(await screen.findByLabelText('Type the English term'), 'door');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText("Next time you'll type the English term.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(async () => expect((await db.cards.where('setId').equals(id).toArray()).some((c) => c.stage === 2)).toBe(true));
  });

  it('scrolls the picked and the correct option into view after answering', async () => {
    const scroll = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scroll });
    try {
      const id = await setWithStage(0);
      const { user } = renderRoute(`/sets/${id}/learn`);
      await screen.findByText('Choose the matching translation');
      const first = shownTerm();
      const correct = screen.getByRole('button', { name: pairs[first] });
      const wrong = screen.getByRole('button', { name: pairs[first === 'luggage' ? 'departure' : 'luggage'] });
      expect(scroll).not.toHaveBeenCalled();
      await user.click(wrong);
      await waitFor(() => expect(scroll.mock.contexts).toContain(correct));
      expect(scroll.mock.contexts).toContain(wrong);
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });
});

describe('LearnPage wording', () => {
  it('calls the answer side a translation in multiple choice', async () => {
    const id = await setWithStage(0);
    renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByText('Choose the matching translation')).toBeInTheDocument();
    expect(screen.getByText('Term')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/definition/i);
  });

  it('labels the prompt Translation and the feedback says translation when typing the English term', async () => {
    const id = await setWithStage(2);
    const { user } = renderRoute(`/sets/${id}/learn`);
    const input = await screen.findByLabelText('Type the English term');
    expect(screen.getByText('Translation')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/definition/i);
    await user.type(input, shownDefinitionTerm());
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText("Next time you'll type the Slovak translation.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/definition/i);
  });

  it('labels the prompt Term and asks for the translation when typing the other way', async () => {
    const id = await setWithStage(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByLabelText('Type the translation in Slovak')).toBeInTheDocument();
    expect(screen.getByText('Term')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Type the translation in Slovak'), 'nothing like it');
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/definition/i);
  });
});

describe('LearnPage card details', () => {
  const detailed = [
    { term: 'luggage', definition: 'batozina', meaning: 'bags that you carry when you travel', examples: 'My luggage was lost.\nPut your luggage here.' },
    { term: 'departure', definition: 'odchod', meaning: 'the act of leaving a place', examples: 'The departure was delayed.' },
  ];

  async function detailedSet(stage: Stage) {
    const id = await createSet({ title: 'Details', definitionLang: 'sk', cards: detailed });
    await db.cards.where('setId').equals(id).modify({ stage });
    return id;
  }

  it('never shows the definition or the examples of a card in multiple choice', async () => {
    const id = await detailedSet(0);
    renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    expect(document.body).not.toHaveTextContent(/bags that you carry|act of leaving|was lost|put your luggage|was delayed/i);
  });

  it('does not accept the definition as the translation and does not reveal it afterwards', async () => {
    const id = await detailedSet(3);
    const { user } = renderRoute(`/sets/${id}/learn`);
    const input = await screen.findByLabelText('Type the translation in Slovak');
    const card = detailed.find((c) => c.term === screen.getByText(/^(luggage|departure)$/).textContent)!;
    await user.type(input, card.meaning);
    await user.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/bags that you carry|act of leaving|was lost|put your luggage|was delayed/i);
  });
});

describe('LearnPage small sets', () => {
  it.each([0, 1])('does not start a round for a set with %i cards and leaves for the set page', async (count) => {
    const id = await createSet({
      title: 'Tiny',
      definitionLang: 'sk',
      cards: [{ term: 'luggage', definition: 'batožina' }].slice(0, count),
    });
    const { router } = renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByRole('heading', { name: 'Tiny' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/sets/${id}`);
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByText('Choose the matching translation')).not.toBeInTheDocument();
    expect((await db.sets.get(id))?.lastStudiedAt).toBeUndefined();
  });
});

describe('LearnPage progress and input', () => {
  it('reads the progress numbers as "N mastered" and "N terms" to a screen reader', async () => {
    const id = await setWithStage(0, { luggage: 'batožina', departure: 'odchod, odlet', gate: 'brána' });
    await db.cards.filter((c) => c.setId === id && c.term === 'luggage').modify({ stage: 4 });
    renderRoute(`/sets/${id}/learn`);
    await screen.findByText('Choose the matching translation');
    const mastered = screen.getByText('mastered', { selector: '.visually-hidden' }).parentElement!;
    expect(mastered).toHaveTextContent('1 mastered');
    expect(mastered).not.toHaveAttribute('aria-label');
    const total = screen.getByText('terms', { selector: '.visually-hidden' }).parentElement!;
    expect(total).toHaveTextContent('3 terms');
    expect(total).not.toHaveAttribute('aria-label');
    // The visible text is still just the two numbers.
    expect(mastered.firstChild?.textContent).toBe('1');
    expect(total.firstChild?.textContent).toBe('3');
  });

  it('asks the phone keyboard for a Go key on the answer input', async () => {
    const id = await setWithStage(2);
    renderRoute(`/sets/${id}/learn`);
    expect(await screen.findByLabelText('Type the English term')).toHaveAttribute('enterkeyhint', 'go');
  });
});
