import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { resetDb } from '../test/db';
import { saveSetting } from '../db/settings';
import { SettingsProvider } from './SettingsContext';
import { ThemeSync } from './ThemeSync';

beforeEach(async () => {
  await resetDb();
  delete document.documentElement.dataset.theme;
});

describe('app shell', () => {
  it('shows the not-found page for unknown routes', async () => {
    renderRoute('/nope');
    expect(await screen.findByText("This page doesn't exist")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toBeInTheDocument();
  });

  it('applies the saved theme to the document', async () => {
    await saveSetting('theme', 'dark');
    render(
      <SettingsProvider>
        <ThemeSync />
      </SettingsProvider>,
    );
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
  });
});
