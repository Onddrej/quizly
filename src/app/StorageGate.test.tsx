import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { openDatabase } from '../db/schema';
import { StorageGate } from './StorageGate';

// Only this file is affected: Vitest isolates module mocks per test file.
vi.mock('../db/schema', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/schema')>()),
  openDatabase: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(openDatabase).mockReset();
});

describe('StorageGate', () => {
  it('renders nothing while the database opens, then renders its children', async () => {
    let finishOpening!: () => void;
    vi.mocked(openDatabase).mockReturnValue(
      new Promise<void>((resolve) => {
        finishOpening = resolve;
      }),
    );

    const { container } = render(
      <StorageGate>
        <p>App content</p>
      </StorageGate>,
    );

    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();

    finishOpening();
    expect(await screen.findByText('App content')).toBeInTheDocument();
  });

  it('shows the failure screen instead of the children when IndexedDB is unavailable', async () => {
    vi.mocked(openDatabase).mockRejectedValue(new Error('IndexedDB is not available'));

    render(
      <StorageGate>
        <p>App content</p>
      </StorageGate>,
    );

    expect(await screen.findByRole('heading', { name: "Quizly can't save data in this browser mode" })).toBeInTheDocument();
    expect(screen.getByText('Open it in a normal window.')).toBeInTheDocument();
    expect(screen.queryByText('App content')).not.toBeInTheDocument();
  });
});
