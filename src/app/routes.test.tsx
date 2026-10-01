import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router';
import { routes } from './routes';

describe('route table', () => {
  // The last match is the leaf route, whether or not the route objects are nested.
  const resolve = (path: string) => {
    const leaf = matchRoutes(routes, path)?.at(-1);
    return { route: leaf?.route.path, params: leaf?.params };
  };
  it.each([
    ['/', '/', {}],
    ['/create', '/create', {}],
    ['/sets/xyz', '/sets/:setId', { setId: 'xyz' }],
    ['/sets/xyz/edit', '/sets/:setId/edit', { setId: 'xyz' }],
    ['/sets/xyz/flashcards', '/sets/:setId/flashcards', { setId: 'xyz' }],
    ['/sets/xyz/learn', '/sets/:setId/learn', { setId: 'xyz' }],
    ['/settings', '/settings', {}],
  ])('%s resolves to %s', (path, route, params) => {
    const r = resolve(path);
    expect(r.route).toBe(route);
    expect(r.params).toMatchObject(params);
  });
  it.each(['/nope', '/sets', '/sets/xyz/bogus', '/create/extra'])('%s falls through to the catch-all', (path) => {
    expect(resolve(path).route).toBe('*');
  });
});
