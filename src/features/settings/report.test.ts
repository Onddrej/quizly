import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSet } from '../../db/sets';
import { getDatabaseStats } from '../../db/stats';
import { resetDb } from '../../test/db';
import { collectEnvironment, formatBytes } from './report';

beforeEach(resetDb);

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
    [3.25 * 1024 ** 3, '3.3 GB'],
  ])('%d bytes -> %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe('getDatabaseStats', () => {
  it('counts the sets and cards on this device', async () => {
    expect(await getDatabaseStats()).toEqual({ sets: 0, cards: 0 });
    const cards = [
      { term: 'a', definition: 'x' },
      { term: 'b', definition: 'y' },
    ];
    await createSet({ title: 'One', definitionLang: 'sk', cards });
    await createSet({ title: 'Two', definitionLang: 'sk', cards: cards.slice(0, 1) });
    expect(await getDatabaseStats()).toEqual({ sets: 2, cards: 3 });
  });
});

describe('collectEnvironment', () => {
  const label = (env: Array<[string, string]>, name: string) => env.find(([k]) => k === name)?.[1];

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'storage');
  });

  it('reports the build, the browser, how the app runs, connectivity and the stored data', async () => {
    await createSet({ title: 'One', definitionLang: 'sk', cards: [{ term: 'a', definition: 'x' }] });
    const env = await collectEnvironment();
    expect(env.map(([k]) => k)).toEqual(['Build', 'Browser', 'Display', 'Online', 'Storage', 'Data']);
    expect(label(env, 'Build')).toMatch(/^\S+ \(\S+\)$/);
    expect(label(env, 'Browser')).toBe(navigator.userAgent);
    expect(label(env, 'Display')).toBe('browser tab');
    expect(['yes', 'no']).toContain(label(env, 'Online'));
    expect(label(env, 'Data')).toBe('1 set, 1 card');
  });

  it('says the storage figures are unknown when the browser cannot tell', async () => {
    expect(label(await collectEnvironment(), 'Storage')).toBe('unknown');
  });

  it('reports usage, quota and whether the storage is persistent', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 2 * 1024 * 1024, quota: 1024 ** 3 }), persisted: async () => true },
    });
    expect(label(await collectEnvironment(), 'Storage')).toBe('2.0 MB used of 1.0 GB, persistent');
  });

  it('marks storage that may be cleared by the browser', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 1024, quota: 1024 ** 2 }), persisted: async () => false },
    });
    expect(label(await collectEnvironment(), 'Storage')).toBe('1.0 KB used of 1.0 MB, not persistent');
  });

  it('never throws, even when the storage API fails', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => {
          throw new Error('denied');
        },
        persisted: async () => true,
      },
    });
    expect(label(await collectEnvironment(), 'Storage')).toBe('unknown');
  });
});
