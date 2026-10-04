import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, RouterProvider, createHashRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { NavigationTracker, resetNavigationTracking, useLeave } from './navigation';
import { routes } from './routes';
import { SettingsProvider } from './SettingsContext';
import { ToastProvider } from '../ui/Toast';
import { resetDb } from '../test/db';
import { createSet } from '../db/sets';

// These tests drive a real router, and the whole suite runs many files in parallel: under CPU load the defaults (1 s for
// finders and waitFor, 5 s per test) are too tight, so give every wait room. Waiting longer never hides a wrong result.
configure({ asyncUtilTimeout: 10_000 });
vi.setConfig({ testTimeout: 30_000 });

// jsdom has a real session history, and react-router's hash router keeps each entry's position in history.state.idx,
// so these tests read the stack the way the Android system Back button walks it.
const idx = () => (window.history.state as { idx?: number } | null)?.idx;

type Router = ReturnType<typeof createHashRouter>;
let router: Router | undefined;

beforeEach(async () => {
  await resetDb();
  resetNavigationTracking();
  window.history.replaceState(null, '', '#/');
});

afterEach(() => {
  router?.dispose();
  router = undefined;
});

const goto = (to: string, replace = false) => act(() => router!.navigate(to, { replace }));
// A pop or replace finishes asynchronously (popstate, blockers): wait for the final action and position.
const expectArrived = (action: 'POP' | 'REPLACE' | 'PUSH', index: number) =>
  waitFor(() => {
    expect(router!.state.historyAction).toBe(action);
    expect(idx()).toBe(index);
  });
const pressBack = async (expectedPath: string) => {
  window.history.back();
  await waitFor(() => expect(router!.state.location.pathname).toBe(expectedPath));
};

function Leave({ target }: { target: string }) {
  const leave = useLeave(target);
  return <button onClick={leave}>Leave</button>;
}

const small: RouteObject[] = [
  {
    element: (
      <>
        <NavigationTracker />
        <Outlet />
      </>
    ),
    children: [
      { path: '/', element: <h1>Home</h1> },
      { path: '/a', element: <><h1>A</h1><Leave target="/" /></> },
      { path: '/b', element: <><h1>B</h1><Leave target="/" /></> },
      { path: '/c', element: <><h1>C</h1><Leave target="/a" /></> },
    ],
  },
];

function renderSmall(path = '/') {
  window.history.replaceState(null, '', `#${path}`);
  router = createHashRouter(small);
  render(<RouterProvider router={router} />);
  return userEvent.setup();
}

describe('useLeave', () => {
  it('pops when the target page is directly behind, leaving no entry to go back to', async () => {
    const user = renderSmall('/');
    await goto('/a');
    expect(idx()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await expectArrived('POP', 0);
  });

  it('replaces the page it leaves when the target is not directly behind', async () => {
    const user = renderSmall('/');
    await goto('/a');
    await goto('/b'); // /b leaves to "/", but the page behind it is /a
    const before = window.history.length;
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await expectArrived('REPLACE', 2);
    expect(window.history.length).toBe(before);
  });

  it('replaces when the page is the first entry of the session', async () => {
    const user = renderSmall('/a');
    expect(idx()).toBe(0);
    const before = window.history.length;
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await expectArrived('REPLACE', 0);
    expect(window.history.length).toBe(before);
  });

  it('tracks a replaced entry, so the page behind it is still recognized', async () => {
    const user = renderSmall('/');
    await goto('/a');
    await goto('/b', true); // /b took the place of /a
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    await expectArrived('POP', 0);
  });

  it('tracks entries after going back and pushing a different page', async () => {
    const user = renderSmall('/');
    await goto('/a');
    await pressBack('/');
    await goto('/c'); // /c now sits where /a was; its target "/a" is no longer behind it
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'A' })).toBeInTheDocument();
    await expectArrived('REPLACE', 1);
  });

  it('falls back to replacing on a memory router, which has no history.state', async () => {
    const memory = createMemoryRouter(small, { initialEntries: ['/', '/a'], initialIndex: 1 });
    render(<RouterProvider router={memory} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(memory.state.historyAction).toBe('REPLACE');
    memory.dispose();
  });
});

function renderApp(path: string) {
  window.history.replaceState(null, '', `#${path}`);
  router = createHashRouter(routes);
  const user = userEvent.setup();
  render(
    <SettingsProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SettingsProvider>,
  );
  return user;
}

/** Waits for Home and lets React run the NavigationTracker's first effect before the test navigates away from it. */
const homeReady = async () => {
  await screen.findByRole('heading', { name: 'Quizly' });
  await act(async () => {});
};

const setOf = (title: string) => createSet({ title, definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });

describe('leaving pages through history', () => {
  it('Home, Create, Close pops back to Home, so system Back does not reopen the editor', async () => {
    const user = renderApp('/');
    await homeReady();
    await goto('/create');
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('heading', { name: 'Quizly' })).toBeInTheDocument();
    await waitFor(() => {
      expect(idx()).toBe(0);
      expect(window.location.hash).toBe('#/');
    });
  });

  it('discarding changes after Close pops as well', async () => {
    const user = renderApp('/');
    await homeReady();
    await goto('/create');
    await user.type(await screen.findByLabelText('Title'), 'D');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' })); // a blocked pop is reported on popstate
    expect(await screen.findByRole('heading', { name: 'Quizly' })).toBeInTheDocument();
    await waitFor(() => {
      expect(idx()).toBe(0);
      expect(window.location.hash).toBe('#/');
    });
  });

  it('Keep editing after a blocked Close restores the history position, and Discard then still pops', async () => {
    const user = renderApp('/');
    await homeReady();
    await goto('/create');
    await user.type(await screen.findByLabelText('Title'), 'D');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(idx()).toBe(1)); // the blocked pop is undone
    expect(router!.state.location.pathname).toBe('/create');
    expect(screen.getByLabelText('Title')).toHaveValue('D');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(await screen.findByRole('heading', { name: 'Quizly' })).toBeInTheDocument();
    await waitFor(() => expect(idx()).toBe(0));
  });

  it('Set, Edit, Save pops back to the Set page, and one more Back reaches Home', async () => {
    const id = await setOf('T');
    const user = renderApp('/');
    await homeReady();
    await goto(`/sets/${id}`);
    await goto(`/sets/${id}/edit`);
    expect(idx()).toBe(2);
    await user.type(await screen.findByLabelText('Title'), '!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'T!' })).toBeInTheDocument();
    await expectArrived('POP', 1);
    await pressBack('/');
    await waitFor(() => expect(idx()).toBe(0));
  });

  it('Set, Edit, Close pops back to the Set page', async () => {
    const id = await setOf('T');
    const user = renderApp('/');
    await homeReady();
    await goto(`/sets/${id}`);
    await goto(`/sets/${id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    await waitFor(() => expect(idx()).toBe(1));
  });

  it('an editor opened as the first entry is replaced by the Set page, adding no entry', async () => {
    const id = await setOf('T');
    const user = renderApp(`/sets/${id}/edit`);
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('heading', { name: 'T' })).toBeInTheDocument();
    await expectArrived('REPLACE', 0);
  });

  it('saving a new set replaces the editor, so system Back from the Set page reaches Home', async () => {
    const user = renderApp('/');
    await homeReady();
    await goto('/create');
    await user.type(await screen.findByLabelText('Title'), 'N');
    await user.type(screen.getAllByLabelText('Term')[0], 'gate');
    await user.type(screen.getAllByLabelText('Translation')[0], 'brána');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'N' })).toBeInTheDocument();
    await waitFor(() => expect(idx()).toBe(1));
    await pressBack('/');
  });

  it('the Set page Back button pops to Home when Home is directly behind', async () => {
    const id = await setOf('T');
    const user = renderApp('/');
    await homeReady();
    await goto(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Quizly' })).toBeInTheDocument();
    await expectArrived('POP', 0);
  });

  it('the Set page Back button replaces the page when it is the first entry', async () => {
    const id = await setOf('T');
    const user = renderApp(`/sets/${id}`);
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Quizly' })).toBeInTheDocument();
    await expectArrived('REPLACE', 0);
  });
});
