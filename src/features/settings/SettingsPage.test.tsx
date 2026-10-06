import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { loadSettings } from '../../db/settings';
import { createSet } from '../../db/sets';
import { createBackup, serializeBackup } from '../../db/backup';
import { db } from '../../db/schema';

beforeEach(resetDb);

describe('SettingsPage', () => {
  it('saves the theme and accent', async () => {
    const { user } = renderRoute('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    await user.click(screen.getByRole('radio', { name: 'UK English' }));
    await waitFor(async () => {
      const settings = await loadSettings();
      expect(settings.theme).toBe('dark');
      expect(settings.accent).toBe('en-GB');
    });
  });

  it('explains when pronunciation is not available', async () => {
    renderRoute('/settings');
    expect(await screen.findByText("Pronunciation isn't available in this browser.")).toBeInTheDocument();
  });

  it('rejects an invalid backup file', async () => {
    const { user } = renderRoute('/settings');
    const file = new File(['{"foo":1}'], 'backup.json', { type: 'application/json' });
    await user.upload(await screen.findByLabelText('Backup file'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent("This file isn't a Quizly backup.");
  });

  it('imports a valid backup after confirmation', async () => {
    await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const text = serializeBackup(await createBackup());
    await resetDb();
    const { user } = renderRoute('/settings');
    await user.upload(await screen.findByLabelText('Backup file'), new File([text], 'b.json', { type: 'application/json' }));
    expect(await screen.findByText('Import 1 set and 1 card? Sets that already exist on this device will be replaced.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(async () => expect(await db.sets.count()).toBe(1));
  });
});
