import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, openDatabase } from './schema';
import { completeRound, createSet, deleteSet, listSetSummaries, markStudied, resetProgress, updateSet } from './sets';
import { setCardStage, toggleStar } from './cards';
import { createBackup, importBackup } from './backup';
import { loadSettings, saveSetting } from './settings';
import { diagnostics, SLOW_MS } from '../lib/diagnostics';
import { resetDb } from '../test/db';

/** Moves the monotonic clock by `step` ms every time it is read, so every traced operation looks `step` ms slow. */
function slowClock(step: number) {
  let t = 0;
  return vi.spyOn(performance, 'now').mockImplementation(() => (t += step));
}

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const draft = { title: 'Secret title', definitionLang: 'sk', cards: [{ term: 'secretterm', definition: 'tajnypreklad', meaning: 'hidden meaning', examples: 'hidden example' }] };

describe('database operations are traced', () => {
  it('logs nothing while operations are fast', async () => {
    const id = await createSet(draft);
    await updateSet(id, draft);
    await deleteSet(id);
    expect(diagnostics.entries()).toEqual([]);
  });

  it('logs every instrumented operation by name when it is slow', async () => {
    const id = await createSet(draft);
    const [card] = await db.cards.where('setId').equals(id).toArray();
    const backup = await createBackup();

    slowClock(SLOW_MS + 500);
    await openDatabase();
    await loadSettings();
    await saveSetting('accent', 'en-GB');
    await createSet(draft);
    await updateSet(id, draft);
    await resetProgress(id);
    await completeRound(id);
    await markStudied(id);
    await listSetSummaries();
    await setCardStage(card.id, 2);
    await toggleStar(card.id);
    await createBackup();
    await importBackup(backup);
    await deleteSet(id);

    const logged = new Set(diagnostics.entries().filter((e) => e.kind === 'op-slow').map((e) => e.op));
    expect([...logged].sort()).toEqual(
      [
        'completeRound',
        'createBackup',
        'createSet',
        'deleteSet',
        'importBackup',
        'listSetSummaries',
        'loadSettings',
        'markStudied',
        'openDatabase',
        'resetProgress',
        'saveSetting',
        'setCardStage',
        'toggleStar',
        'updateSet',
      ].sort(),
    );
  });

  it('records when a write transaction body finished, so a slow commit shows up in the log', async () => {
    const id = await createSet(draft);
    slowClock(SLOW_MS + 500);
    await deleteSet(id);
    const entry = diagnostics.entries().find((e) => e.op === 'deleteSet');
    expect(entry).toMatchObject({ kind: 'op-slow', op: 'deleteSet' });
    expect(entry?.phases).toHaveProperty('body');
    expect(entry!.phases!.body).toBeLessThanOrEqual(entry!.ms!);
  });

  it('logs a failed write and still rejects with the original error', async () => {
    await expect(updateSet('missing', draft)).rejects.toThrow('Set not found');
    expect(diagnostics.entries()).toMatchObject([{ kind: 'op-failed', op: 'updateSet', message: 'Error: Set not found' }]);
  });

  it('never puts card or set content into the log', async () => {
    slowClock(SLOW_MS + 500);
    const id = await createSet(draft);
    await updateSet(id, draft);
    await expect(updateSet('missing', draft)).rejects.toThrow();
    await deleteSet(id);
    expect(diagnostics.entries().length).toBeGreaterThan(0);
    const raw = localStorage.getItem('quizly.diagnostics') ?? '';
    for (const secret of ['Secret title', 'secretterm', 'tajnypreklad', 'hidden meaning', 'hidden example']) {
      expect(raw).not.toContain(secret);
    }
  });
});
