import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import { createSet, listSetSummaries, updateSet, type CardDraft } from './sets';
import { listCards, setCardStage, toggleStar } from './cards';
import { BackupError, createBackup, importBackup, parseBackup, serializeBackup } from './backup';
import { normalizeCardDetails } from '../lib/cardDetails';
import { resetDb } from '../test/db';

beforeEach(resetDb);

const has = (card: object, key: string) => Object.hasOwn(card, key);

async function rawCards(setId: string) {
  return (await db.cards.where('setId').equals(setId).sortBy('position')) as unknown as Record<string, unknown>[];
}

describe('normalizeCardDetails', () => {
  it('returns an empty object when nothing is given', () => {
    const result = normalizeCardDetails({});
    expect(result).toEqual({});
    expect(has(result, 'meaning')).toBe(false);
    expect(has(result, 'examples')).toBe(false);
  });

  it('omits properties whose input is explicitly undefined', () => {
    const result = normalizeCardDetails({ meaning: undefined, examples: undefined });
    expect(Object.keys(result)).toEqual([]);
  });

  it('trims the meaning', () => {
    expect(normalizeCardDetails({ meaning: '  a place to board a plane \t' })).toEqual({ meaning: 'a place to board a plane' });
  });

  it('omits an empty or whitespace-only meaning', () => {
    for (const meaning of ['', '   ', '\t\n  ']) {
      expect(Object.keys(normalizeCardDetails({ meaning }))).toEqual([]);
    }
  });

  it('keeps spaces inside the meaning', () => {
    expect(normalizeCardDetails({ meaning: ' to  wait ' })).toEqual({ meaning: 'to  wait' });
  });

  it('trims every example line, drops empty lines and joins the rest with a newline', () => {
    const examples = '  I missed my flight.  \n\n   \n The gate is closed.\t\n';
    expect(normalizeCardDetails({ examples })).toEqual({ examples: 'I missed my flight.\nThe gate is closed.' });
  });

  it('handles Windows and old Mac line breaks', () => {
    expect(normalizeCardDetails({ examples: 'One.\r\n\r\n Two.\r Three.' })).toEqual({ examples: 'One.\nTwo.\nThree.' });
  });

  it('keeps a single example line as it is (trimmed)', () => {
    expect(normalizeCardDetails({ examples: '  Only one.  ' })).toEqual({ examples: 'Only one.' });
  });

  it('omits examples that are empty, whitespace or only line breaks', () => {
    for (const examples of ['', '   ', '\n', ' \n \n\t\n', '\r\n\r\n']) {
      expect(Object.keys(normalizeCardDetails({ examples }))).toEqual([]);
    }
  });

  it('normalizes meaning and examples independently', () => {
    expect(normalizeCardDetails({ meaning: '   ', examples: ' A. \n B. ' })).toEqual({ examples: 'A.\nB.' });
    expect(normalizeCardDetails({ meaning: ' m ', examples: '\n' })).toEqual({ meaning: 'm' });
  });

  it('returns only meaning and examples, so spreading the result never touches other card fields', () => {
    const draft: CardDraft = { id: 'x', term: 'gate', definition: 'brána', meaning: ' m ', examples: ' e ' };
    expect(normalizeCardDetails(draft)).toEqual({ meaning: 'm', examples: 'e' });
  });

  it('produces the newline as the single code point U+000A', () => {
    const joined = normalizeCardDetails({ examples: 'A.\nB.' }).examples ?? '';
    expect([...joined].map((c) => c.codePointAt(0))).toEqual([0x41, 0x2e, 0x0a, 0x42, 0x2e]);
  });
});

describe('createSet with card details', () => {
  it('stores trimmed extras and normalized example lines on new cards', async () => {
    const id = await createSet({
      title: 'Travel',
      definitionLang: 'sk',
      cards: [
        {
          term: 'gate',
          definition: 'brána',
          meaning: '  the place where you board a plane  ',
          examples: '  Go to gate 12.  \n\n We waited at the gate.\n',
        },
      ],
    });
    const [card] = await listCards(id);
    expect(card.term).toBe('gate');
    expect(card.definition).toBe('brána');
    expect(card.meaning).toBe('the place where you board a plane');
    expect(card.examples).toBe('Go to gate 12.\nWe waited at the gate.');
  });

  it('omits empty extras: the property is absent, not undefined', async () => {
    const id = await createSet({
      title: 'Travel',
      definitionLang: 'sk',
      cards: [
        { term: 'a', definition: '1', meaning: '', examples: '' },
        { term: 'b', definition: '2', meaning: '   ', examples: ' \n \n ' },
        { term: 'c', definition: '3', meaning: undefined, examples: undefined },
        { term: 'd', definition: '4' },
      ],
    });
    const cards = await rawCards(id);
    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(has(card, 'meaning')).toBe(false);
      expect('examples' in card).toBe(false);
      expect(Object.keys(card).sort()).toEqual(['definition', 'id', 'position', 'setId', 'stage', 'starred', 'term']);
    }
  });

  it('stores one extra without the other', async () => {
    const id = await createSet({
      title: 'T',
      definitionLang: 'sk',
      cards: [
        { term: 'a', definition: '1', meaning: 'only meaning' },
        { term: 'b', definition: '2', examples: 'Only examples.' },
      ],
    });
    const [a, b] = await rawCards(id);
    expect(a.meaning).toBe('only meaning');
    expect(has(a, 'examples')).toBe(false);
    expect(has(b, 'meaning')).toBe(false);
    expect(b.examples).toBe('Only examples.');
  });
});

describe('updateSet with card details', () => {
  async function setWithOneCard(card: Partial<CardDraft> = {}) {
    const id = await createSet({ title: 'T', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána', ...card }] });
    const [stored] = await listCards(id);
    await setCardStage(stored.id, 3, 500);
    await toggleStar(stored.id);
    return { id, cardId: stored.id };
  }

  const progressOf = async (cardId: string) => {
    const card = await db.cards.get(cardId);
    return { stage: card?.stage, starred: card?.starred, lastAnsweredAt: card?.lastAnsweredAt };
  };

  it('sets extras on a kept card and keeps stage, star and answer time', async () => {
    const { id, cardId } = await setWithOneCard();
    await updateSet(id, {
      title: 'T',
      definitionLang: 'sk',
      cards: [{ id: cardId, term: 'gate', definition: 'brána', meaning: '  a door to a plane ', examples: ' Gate 3. \n\n Gate 4. ' }],
    });
    const [card] = await listCards(id);
    expect(card.id).toBe(cardId);
    expect(card.meaning).toBe('a door to a plane');
    expect(card.examples).toBe('Gate 3.\nGate 4.');
    expect(await progressOf(cardId)).toEqual({ stage: 3, starred: true, lastAnsweredAt: 500 });
  });

  it('changes existing extras', async () => {
    const { id, cardId } = await setWithOneCard({ meaning: 'old meaning', examples: 'Old one.' });
    await updateSet(id, {
      title: 'T',
      definitionLang: 'sk',
      cards: [{ id: cardId, term: 'gate', definition: 'brána', meaning: 'new meaning', examples: 'New one.\nNew two.' }],
    });
    const [card] = await listCards(id);
    expect(card.meaning).toBe('new meaning');
    expect(card.examples).toBe('New one.\nNew two.');
    expect(await progressOf(cardId)).toEqual({ stage: 3, starred: true, lastAnsweredAt: 500 });
  });

  it('clears extras with empty or whitespace values: the stored property is removed', async () => {
    const { id, cardId } = await setWithOneCard({ meaning: 'old meaning', examples: 'Old one.' });
    await updateSet(id, {
      title: 'T',
      definitionLang: 'sk',
      cards: [{ id: cardId, term: 'gate', definition: 'brána', meaning: '', examples: ' \n  ' }],
    });
    const [card] = await rawCards(id);
    expect(has(card, 'meaning')).toBe(false);
    expect('examples' in card).toBe(false);
    expect(await progressOf(cardId)).toEqual({ stage: 3, starred: true, lastAnsweredAt: 500 });
  });

  it('clears only the extra that was emptied', async () => {
    const { id, cardId } = await setWithOneCard({ meaning: 'keep me', examples: 'Remove me.' });
    await updateSet(id, {
      title: 'T',
      definitionLang: 'sk',
      cards: [{ id: cardId, term: 'gate', definition: 'brána', meaning: 'keep me', examples: '' }],
    });
    const [card] = await rawCards(id);
    expect(card.meaning).toBe('keep me');
    expect(has(card, 'examples')).toBe(false);
  });

  it('removes old extras from a kept card whose draft has no extras at all', async () => {
    const { id, cardId } = await setWithOneCard({ meaning: 'old meaning', examples: 'Old one.' });
    await updateSet(id, { title: 'T', definitionLang: 'sk', cards: [{ id: cardId, term: 'gates', definition: 'brány' }] });
    const [card] = await rawCards(id);
    expect(card.id).toBe(cardId);
    expect(card.term).toBe('gates');
    expect(has(card, 'meaning')).toBe(false);
    expect('examples' in card).toBe(false);
    expect(await progressOf(cardId)).toEqual({ stage: 3, starred: true, lastAnsweredAt: 500 });
  });

  it('gives new cards their extras and omits empty ones', async () => {
    const { id } = await setWithOneCard();
    await updateSet(id, {
      title: 'T',
      definitionLang: 'sk',
      cards: [
        { term: 'new one', definition: 'nové', meaning: ' fresh ', examples: ' It is new. ' },
        { term: 'new two', definition: 'druhé', meaning: '', examples: undefined },
      ],
    });
    const [one, two] = await rawCards(id);
    expect(one.meaning).toBe('fresh');
    expect(one.examples).toBe('It is new.');
    expect(one.stage).toBe(0);
    expect(has(two, 'meaning')).toBe(false);
    expect('examples' in two).toBe(false);
  });

  it('treats a draft id from another set as a new card and leaves the other set alone', async () => {
    const other = await setWithOneCard({ meaning: 'other meaning', examples: 'Other.' });
    const mine = await createSet({ title: 'Mine', definitionLang: 'sk', cards: [{ term: 'x', definition: 'y' }] });
    await updateSet(mine, {
      title: 'Mine',
      definitionLang: 'sk',
      cards: [{ id: other.cardId, term: 'gate', definition: 'brána', meaning: 'my meaning', examples: 'Mine.' }],
    });
    const [created] = await rawCards(mine);
    expect(created.id).not.toBe(other.cardId);
    expect(created.setId).toBe(mine);
    expect(created.stage).toBe(0);
    expect(created.starred).toBe(false);
    expect(has(created, 'lastAnsweredAt')).toBe(false);
    expect(created.meaning).toBe('my meaning');
    expect(created.examples).toBe('Mine.');
    const [untouched] = await rawCards(other.id);
    expect(untouched.id).toBe(other.cardId);
    expect(untouched.meaning).toBe('other meaning');
    expect(untouched.examples).toBe('Other.');
    expect(await progressOf(other.cardId)).toEqual({ stage: 3, starred: true, lastAnsweredAt: 500 });
  });
});

describe('backup with card details', () => {
  const twoCards: CardDraft[] = [
    { term: 'gate', definition: 'brána', meaning: 'where you board a plane', examples: 'Go to gate 12.\nThe gate closed.' },
    { term: 'delay', definition: 'meškanie' },
  ];

  it('round-trips the extras and keeps the properties absent when empty', async () => {
    const id = await createSet({ title: 'Travel', definitionLang: 'sk', cards: twoCards }, 1000);
    const text = serializeBackup(await createBackup(new Date('2026-10-02T10:00:00Z')));

    const exported = JSON.parse(text) as { cards: Record<string, unknown>[] };
    const exportedGate = exported.cards.find((c) => c.term === 'gate');
    const exportedDelay = exported.cards.find((c) => c.term === 'delay');
    expect(exportedGate?.meaning).toBe('where you board a plane');
    expect(exportedGate?.examples).toBe('Go to gate 12.\nThe gate closed.');
    expect(has(exportedDelay as object, 'meaning')).toBe(false);
    expect(has(exportedDelay as object, 'examples')).toBe(false);

    await resetDb();
    const result = await importBackup(parseBackup(text));
    expect(result).toEqual({ sets: 1, cards: 2 });
    const [gate, delay] = await rawCards(id);
    expect(gate.meaning).toBe('where you board a plane');
    expect(gate.examples).toBe('Go to gate 12.\nThe gate closed.');
    expect(has(delay, 'meaning')).toBe(false);
    expect('examples' in delay).toBe(false);
  });

  const validSet = { id: 's', title: 'T', definitionLang: 'sk', createdAt: 1, updatedAt: 1, learnRound: 1 };
  const validCard = { id: 'c', setId: 's', term: 'a', definition: 'b', position: 0, starred: false, stage: 0 };
  const file = (card: Record<string, unknown>) => JSON.stringify({ app: 'quizly', version: 1, exportedAt: '', sets: [validSet], cards: [card] });

  it('accepts old files without meaning and examples and does not add the properties', () => {
    const parsed = parseBackup(file(validCard));
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.cards[0]).sort()).toEqual(['definition', 'id', 'position', 'setId', 'stage', 'starred', 'term']);
  });

  it('copies string meaning and examples to the parsed card', () => {
    const parsed = parseBackup(file({ ...validCard, meaning: 'm', examples: 'A.\nB.' }));
    expect(parsed.cards[0].meaning).toBe('m');
    expect(parsed.cards[0].examples).toBe('A.\nB.');
  });

  it('copies one extra without adding the other', () => {
    const parsed = parseBackup(file({ ...validCard, meaning: 'm' }));
    expect(parsed.cards[0].meaning).toBe('m');
    expect(has(parsed.cards[0], 'examples')).toBe(false);
  });

  const notStrings: unknown[] = [7, 0, null, true, false, ['a'], [], { text: 'a' }, {}];

  it.each(['meaning', 'examples'].flatMap((field) => notStrings.map((value) => [field, value] as const)))(
    'rejects a card with %s = %j',
    (field, value) => {
      expect(() => parseBackup(file({ ...validCard, [field]: value }))).toThrow(BackupError);
    },
  );
});

describe('listSetSummaries with card details', () => {
  it('counts cards the same with and without extras', async () => {
    const plain = await createSet(
      { title: 'Plain', definitionLang: 'sk', cards: [{ term: 'a', definition: '1' }, { term: 'b', definition: '2' }, { term: 'c', definition: '3' }] },
      1000,
    );
    const rich = await createSet(
      {
        title: 'Rich',
        definitionLang: 'sk',
        cards: [
          { term: 'a', definition: '1', meaning: 'm', examples: 'E.' },
          { term: 'b', definition: '2', meaning: 'm' },
          { term: 'c', definition: '3' },
        ],
      },
      1000,
    );
    for (const setId of [plain, rich]) {
      const [first, second] = await listCards(setId);
      await setCardStage(first.id, 4);
      await setCardStage(second.id, 2);
    }
    const summaries = await listSetSummaries();
    const plainSummary = summaries.find((s) => s.set.id === plain);
    const richSummary = summaries.find((s) => s.set.id === rich);
    expect(plainSummary).toMatchObject({ total: 3, counts: { mastered: 1, learning: 1, notStudied: 1 } });
    expect(richSummary?.total).toBe(plainSummary?.total);
    expect(richSummary?.counts).toEqual(plainSummary?.counts);
  });
});
