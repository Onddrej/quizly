import { describe, expect, it } from 'vitest';
import { createDiagnostics, describeError, formatReport, MAX_ENTRIES, SLOW_MS, type KeyValueStore } from './diagnostics';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error('storage blocked');
  },
  setItem: () => {
    throw new Error('storage blocked');
  },
  removeItem: () => {
    throw new Error('storage blocked');
  },
};

/** A clock the test moves by hand: `tick(ms)` advances both the wall clock and the monotonic one. */
function fakeClocks(start = 1_000_000) {
  let wall = start;
  let mono = 0;
  return {
    now: () => wall,
    clock: () => mono,
    tick(ms: number) {
      wall += ms;
      mono += ms;
    },
  };
}

describe('record and read', () => {
  it('stores entries oldest first and stamps them with the wall clock', () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    log.record({ kind: 'error', message: 'first' });
    clocks.tick(500);
    log.record({ kind: 'rejection', message: 'second' });
    expect(log.entries()).toEqual([
      { at: 1_000_000, kind: 'error', message: 'first' },
      { at: 1_000_500, kind: 'rejection', message: 'second' },
    ]);
  });

  it('keeps only the newest entries once the limit is reached', () => {
    const log = createDiagnostics({ store: memoryStore(), maxEntries: 3 });
    for (let i = 1; i <= 5; i++) log.record({ kind: 'error', message: `m${i}` });
    expect(log.entries().map((e) => e.message)).toEqual(['m3', 'm4', 'm5']);
  });

  it('defaults to a hundred entries', () => {
    expect(MAX_ENTRIES).toBe(100);
    const log = createDiagnostics({ store: memoryStore() });
    for (let i = 0; i < MAX_ENTRIES + 20; i++) log.record({ kind: 'error', message: `m${i}` });
    expect(log.entries()).toHaveLength(MAX_ENTRIES);
  });

  it('counts an immediate repeat instead of adding a new entry', () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    log.record({ kind: 'error', message: 'boom' });
    clocks.tick(10);
    log.record({ kind: 'error', message: 'boom' });
    clocks.tick(10);
    log.record({ kind: 'error', message: 'boom' });
    expect(log.entries()).toEqual([{ at: 1_000_020, kind: 'error', message: 'boom', count: 3 }]);
  });

  it('does not merge entries that differ in kind, operation or message', () => {
    const log = createDiagnostics({ store: memoryStore() });
    log.record({ kind: 'error', message: 'boom' });
    log.record({ kind: 'rejection', message: 'boom' });
    log.record({ kind: 'op-failed', op: 'a', message: 'boom' });
    log.record({ kind: 'op-failed', op: 'b', message: 'boom' });
    log.record({ kind: 'op-failed', op: 'b', message: 'other' });
    expect(log.entries()).toHaveLength(5);
  });

  it('survives a reload: a new instance on the same store sees the entries', () => {
    const store = memoryStore();
    createDiagnostics({ store }).record({ kind: 'error', message: 'before reload' });
    expect(createDiagnostics({ store }).entries().map((e) => e.message)).toEqual(['before reload']);
  });

  it('clears the log', () => {
    const log = createDiagnostics({ store: memoryStore() });
    log.record({ kind: 'error', message: 'x' });
    log.clear();
    expect(log.entries()).toEqual([]);
  });
});

describe('damaged or unavailable storage', () => {
  it.each([
    ['not json', '{oops'],
    ['not an array', '{"a":1}'],
    ['null', 'null'],
  ])('treats %s as an empty log and keeps working', (_label, raw) => {
    const store = memoryStore({ 'quizly.diagnostics': raw });
    const log = createDiagnostics({ store });
    expect(log.entries()).toEqual([]);
    log.record({ kind: 'error', message: 'fresh' });
    expect(log.entries().map((e) => e.message)).toEqual(['fresh']);
  });

  it('drops stored items that are not valid entries', () => {
    const good = { at: 5, kind: 'error', message: 'ok' };
    const store = memoryStore({ 'quizly.diagnostics': JSON.stringify([good, { at: 'x', kind: 'error' }, { at: 6, kind: 'bogus' }, 7, null]) });
    expect(createDiagnostics({ store }).entries()).toEqual([good]);
  });

  it('never throws when the storage is blocked', () => {
    const log = createDiagnostics({ store: brokenStore });
    expect(() => log.record({ kind: 'error', message: 'x' })).not.toThrow();
    expect(log.entries()).toEqual([]);
    expect(() => log.clear()).not.toThrow();
  });
});

describe('trace', () => {
  it('records nothing for a fast successful operation and returns its result', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    const result = await log.trace('deleteSet', async () => {
      clocks.tick(SLOW_MS - 1);
      return 42;
    });
    expect(result).toBe(42);
    expect(log.entries()).toEqual([]);
  });

  it('records a slow operation with its duration, once it reaches the threshold', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    await log.trace('deleteSet', async () => {
      clocks.tick(SLOW_MS);
    });
    expect(log.entries()).toEqual([{ at: 1_000_000 + SLOW_MS, kind: 'op-slow', op: 'deleteSet', ms: SLOW_MS }]);
  });

  it('records the checkpoints so a slow commit can be told apart from a slow body', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    await log.trace('deleteSet', async (checkpoint) => {
      clocks.tick(120);
      checkpoint('body');
      clocks.tick(19_880);
    });
    expect(log.entries()[0]).toMatchObject({ kind: 'op-slow', op: 'deleteSet', ms: 20_000, phases: { body: 120 } });
  });

  it('honours a custom threshold', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), slowMs: 50, ...clocks });
    await log.trace('x', async () => {
      clocks.tick(60);
    });
    expect(log.entries()).toHaveLength(1);
  });

  it('records a failure with the error and rethrows the very same error', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    const failure = new Error('Set not found');
    await expect(
      log.trace('updateSet', async () => {
        clocks.tick(5);
        throw failure;
      }),
    ).rejects.toBe(failure);
    const [entry] = log.entries();
    expect(entry).toMatchObject({ kind: 'op-failed', op: 'updateSet', ms: 5, message: 'Error: Set not found' });
    expect(entry.stack).toContain('Error: Set not found');
  });

  it('records a failure that is also slow once, as a failure', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    await expect(
      log.trace('importBackup', async () => {
        clocks.tick(5_000);
        throw new Error('quota');
      }),
    ).rejects.toThrow('quota');
    expect(log.entries().map((e) => e.kind)).toEqual(['op-failed']);
  });

  it('is not affected by a logging problem: the result and the error pass through unchanged', async () => {
    const log = createDiagnostics({ store: brokenStore });
    await expect(log.trace('a', async () => 'fine')).resolves.toBe('fine');
    const failure = new Error('real');
    await expect(
      log.trace('b', async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });

  it('keeps the checkpoint helper harmless when the operation never calls it', async () => {
    const clocks = fakeClocks();
    const log = createDiagnostics({ store: memoryStore(), ...clocks });
    await log.trace('slow', async () => {
      clocks.tick(2_000);
    });
    expect(log.entries()[0]).not.toHaveProperty('phases');
  });
});

describe('recordError', () => {
  it('stores the error under the given kind', () => {
    const log = createDiagnostics({ store: memoryStore() });
    log.recordError('render', new TypeError('x is undefined'));
    expect(log.entries()[0]).toMatchObject({ kind: 'render', message: 'TypeError: x is undefined' });
  });
});

describe('describeError', () => {
  it('describes an Error by name and message, with a short stack', () => {
    const error = new RangeError('too far');
    const described = describeError(error);
    expect(described.message).toBe('RangeError: too far');
    expect(described.stack?.split('\n').length).toBeLessThanOrEqual(6);
  });

  it('describes anything else as text', () => {
    expect(describeError('plain')).toEqual({ message: 'plain' });
    expect(describeError({ a: 1 }).message).toBe('[object Object]');
    expect(describeError(undefined)).toEqual({ message: 'undefined' });
  });

  it('clips very long messages and stacks', () => {
    const error = new Error('x'.repeat(5_000));
    error.stack = Array.from({ length: 50 }, (_, i) => `at frame${i} ${'y'.repeat(200)}`).join('\n');
    const described = describeError(error);
    expect(described.message.length).toBeLessThanOrEqual(300);
    expect(described.stack!.length).toBeLessThanOrEqual(800);
  });
});

describe('formatReport', () => {
  const env: Array<[string, string]> = [
    ['Build', '0.0.0 (abc1234)'],
    ['Storage', '12 MB of 5 GB'],
  ];
  const created = Date.UTC(2026, 9, 6, 15, 30, 0);

  it('starts with the creation time and the environment lines', () => {
    const lines = formatReport([], env, created).split('\n');
    expect(lines[0]).toBe('Quizly diagnostics');
    expect(lines).toContain('Created: 2026-10-06T15:30:00.000Z');
    expect(lines).toContain('Build: 0.0.0 (abc1234)');
    expect(lines).toContain('Storage: 12 MB of 5 GB');
  });

  it('says so when the log is empty', () => {
    expect(formatReport([], env, created)).toContain('Log: no entries');
  });

  it('lists entries oldest first with kind, operation, duration, checkpoints, message and repeat count', () => {
    const report = formatReport(
      [
        { at: Date.UTC(2026, 9, 6, 15, 12, 3, 120), kind: 'op-slow', op: 'deleteSet', ms: 20_143, phases: { body: 90 } },
        { at: Date.UTC(2026, 9, 6, 15, 13, 0), kind: 'error', message: 'TypeError: boom', stack: 'TypeError: boom\n    at a (x.js:1:1)', count: 3 },
      ],
      env,
      created,
    );
    expect(report).toContain('Log: 2 entries, oldest first');
    expect(report).toContain('2026-10-06T15:12:03.120Z  op-slow  deleteSet  20143 ms  (body 90 ms)');
    expect(report).toContain('2026-10-06T15:13:00.000Z  error  TypeError: boom  x3');
    expect(report).toContain('    at a (x.js:1:1)');
    expect(report.indexOf('op-slow')).toBeLessThan(report.indexOf('TypeError: boom  x3'));
  });

  it('uses the singular for one entry', () => {
    expect(formatReport([{ at: 1, kind: 'error', message: 'm' }], env, created)).toContain('Log: 1 entry, oldest first');
  });
});
