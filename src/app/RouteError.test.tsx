import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { RouteError } from './RouteError';
import { routes } from './routes';
import { diagnostics } from '../lib/diagnostics';

const failure = new Error('boom');

// The real Home page is replaced so the real route table can be driven into an error.
vi.mock('../features/home/HomePage', () => ({
  HomePage: () => {
    throw failure;
  },
}));

function Boom(): never {
  throw failure;
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

function expectPlainErrorPage() {
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByText('Try again, or go back Home.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
  expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  expect(consoleError).toHaveBeenCalledWith(failure);
}

describe('RouteError', () => {
  it('replaces the developer error screen with a plain page that leads back Home', () => {
    const router = createMemoryRouter([{ errorElement: <RouteError />, children: [{ path: '/', element: <Boom /> }] }]);
    render(<RouterProvider router={router} />);
    expectPlainErrorPage();
  });

  it('writes the error to the diagnostics log', () => {
    localStorage.clear();
    const router = createMemoryRouter([{ errorElement: <RouteError />, children: [{ path: '/', element: <Boom /> }] }]);
    render(<RouterProvider router={router} />);
    expect(diagnostics.entries()).toMatchObject([{ kind: 'render', message: 'Error: boom' }]);
  });

  it('is wired into the app route table', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expectPlainErrorPage();
  });
});
