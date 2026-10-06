import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { loadSettings } from '../../db/settings';
import { createSet } from '../../db/sets';
import { createBackup, serializeBackup } from '../../db/backup';
import { db } from '../../db/schema';
import { initInstallPrompt } from '../../app/install';

// jsdom has no object URLs. The fakes stay for the whole file, because downloadText revokes the URL in a timer one second after the click.
let downloadedBlob: Blob | undefined;
URL.createObjectURL = (blob: Blob) => ((downloadedBlob = blob), 'blob:fake');
URL.revokeObjectURL = () => undefined;

beforeEach(() => {
  downloadedBlob = undefined;
  return resetDb();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  act(() => {
    window.dispatchEvent(new Event('appinstalled')); // clears the module-level deferred prompt between tests
  });
});

/** A backup file made from one set with one card; the database is emptied afterwards, so importing it adds the set back. */
async function backupFile(): Promise<File> {
  await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána', meaning: 'an exit', examples: 'Go to gate 4.' }] });
  const text = serializeBackup(await createBackup());
  await resetDb();
  return new File([text], 'b.json', { type: 'application/json' });
}

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

describe('SettingsPage export', () => {
  it('downloads quizly-backup-YYYY-MM-DD.json containing the sets and cards', async () => {
    await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána', meaning: 'an exit', examples: 'Go to gate 4.' }] });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    const { user } = renderRoute('/settings');
    await user.click(await screen.findByRole('button', { name: 'Export backup' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]).toMatch(/^quizly-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(
      await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(downloadedBlob!);
      }),
    );
    expect(parsed.sets).toHaveLength(1);
    expect(parsed.cards[0]).toMatchObject({ term: 'gate', meaning: 'an exit', examples: 'Go to gate 4.' });
  });

  it('toasts when the export cannot read the data', async () => {
    vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('boom'));
    const { user } = renderRoute('/settings');
    await user.click(await screen.findByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText("Couldn't export. Try again.")).toBeInTheDocument();
  });
});

describe('SettingsPage import', () => {
  it('shows a toast after confirming and leaves nothing written after cancel', async () => {
    const file = await backupFile();
    const { user } = renderRoute('/settings');
    const input = await screen.findByLabelText('Backup file');
    await user.upload(input, file);
    await screen.findByRole('alertdialog');
    expect((input as HTMLInputElement).value).toBe(''); // reset so picking the same file again fires change
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.sets.count()).toBe(0);
    await user.upload(input, file); // same file again
    await user.click(await screen.findByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Imported 1 set')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.cards.count()).toBe(1);
  });

  it('rejects damaged JSON and clears the error when a valid file follows', async () => {
    const good = await backupFile();
    const { user } = renderRoute('/settings');
    const input = await screen.findByLabelText('Backup file');
    await user.upload(input, new File(['{"app":"quizly","version":1,"sets":['], 'bad.json', { type: 'application/json' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("This file isn't a Quizly backup.");
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.upload(input, good);
    await screen.findByRole('alertdialog');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces an existing set together with its progress and keeps other sets (spec 6.2)', async () => {
    await createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });
    const file = new File([serializeBackup(await createBackup())], 'b.json', { type: 'application/json' });
    await db.cards.toCollection().modify({ stage: 4 });
    await createSet({ title: 'Local only', definitionLang: 'sk', cards: [] });
    const { user } = renderRoute('/settings');
    await user.upload(await screen.findByLabelText('Backup file'), file);
    await user.click(await screen.findByRole('button', { name: 'Import' }));
    await screen.findByText('Imported 1 set');
    expect((await db.cards.toArray()).map((c) => c.stage)).toEqual([0]);
    expect(await db.sets.count()).toBe(2);
  });
});

describe('SettingsPage install', () => {
  it('shows Install only after beforeinstallprompt, prompts, and hides after the choice and on appinstalled', async () => {
    initInstallPrompt();
    const prompt = vi.fn(() => Promise.resolve());
    const makeEvent = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' as const }) });
    const { user } = renderRoute('/settings');
    await screen.findByText('Pronunciation');
    expect(screen.queryByRole('button', { name: 'Install Quizly' })).not.toBeInTheDocument();
    const event = makeEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Install Quizly' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Install Quizly' })).not.toBeInTheDocument());
    act(() => {
      window.dispatchEvent(makeEvent());
    });
    expect(await screen.findByRole('button', { name: 'Install Quizly' })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: 'Install Quizly' })).not.toBeInTheDocument();
  });

  it('a prompt captured before the page mounted is still offered', async () => {
    initInstallPrompt();
    act(() => {
      window.dispatchEvent(Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(), userChoice: new Promise(() => {}) }));
    });
    renderRoute('/settings');
    expect(await screen.findByRole('button', { name: 'Install Quizly' })).toBeInTheDocument();
  });
});

describe('SettingsPage pronunciation', () => {
  class FakeUtterance {
    text: string;
    lang = '';
    rate = 1;
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const stub = (langs: string[]) => {
    const synth = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => langs.map((lang) => ({ lang, name: lang, localService: true })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    return synth;
  };

  it('explains a missing English voice and hides Test voice', async () => {
    stub(['sk-SK']);
    renderRoute('/settings');
    expect(await screen.findByText(/No English voice found on this device/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test voice' })).not.toBeInTheDocument();
  });

  it('Test voice speaks with the chosen accent', async () => {
    const synth = stub(['en-US', 'en-GB']);
    const { user } = renderRoute('/settings');
    await user.click(await screen.findByRole('radio', { name: 'UK English' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'UK English' })).toBeChecked());
    await user.click(screen.getByRole('button', { name: 'Test voice' }));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).lang).toBe('en-GB');
  });
});
