import { useRef, useState } from 'react';
import { Download, Smartphone, Upload, Volume2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useInstallPrompt } from '../../app/install';
import { saveSetting } from '../../db/settings';
import { BackupError, backupFileName, createBackup, importBackup, parseBackup, serializeBackup, type Backup } from '../../db/backup';
import type { Accent, ThemePref } from '../../db/types';
import { useSpeech } from '../../lib/useSpeech';
import { Page } from '../../ui/Page';
import { TopBar } from '../../ui/TopBar';
import { TabBar } from '../../ui/TabBar';
import { Button } from '../../ui/Button';
import { Segmented } from '../../ui/Segmented';
import { InlineConfirm } from '../../ui/InlineConfirm';
import { useToast } from '../../ui/Toast';
import { downloadText, readFileText } from './files';
import styles from './SettingsPage.module.css';

const ACCENTS = [
  { value: 'en-US', label: 'US English' },
  { value: 'en-GB', label: 'UK English' },
] as const satisfies ReadonlyArray<{ value: Accent; label: string }>;

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const satisfies ReadonlyArray<{ value: ThemePref; label: string }>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const speech = useSpeech();
  const { canInstall, install } = useInstallPrompt();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function exportBackup() {
    try {
      downloadText(backupFileName(new Date()), serializeBackup(await createBackup()));
    } catch {
      toast("Couldn't export. Try again.");
    }
  }

  async function onFile(file: File) {
    setImportError(null);
    setPending(null);
    try {
      setPending(parseBackup(await readFileText(file)));
    } catch (error) {
      setImportError(error instanceof BackupError ? error.message : "Couldn't read this file.");
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pending) return;
    try {
      const result = await importBackup(pending);
      setPending(null);
      toast(`Imported ${plural(result.sets, 'set')}`);
    } catch {
      setImportError("Couldn't import. Nothing was changed.");
    }
  }

  return (
    <Page top={<TopBar title="Settings" />} bottom={<TabBar />}>
      <section className={styles.section} aria-labelledby="pronunciation-heading">
        <h2 id="pronunciation-heading" className={styles.sectionTitle}>
          Pronunciation
        </h2>
        <div className={`card ${styles.box}`}>
          <Segmented name="accent" label="Accent" value={settings.accent} options={ACCENTS} onChange={(v) => void saveSetting('accent', v)} />
          {speech.available && (
            <Button variant="outline" icon={<Volume2 size={20} />} onClick={() => speech.say('Hello! This is how your words will sound.')}>
              Test voice
            </Button>
          )}
          {!speech.supported && <p className={styles.note}>Pronunciation isn't available in this browser.</p>}
          {speech.supported && speech.voicesLoaded && !speech.hasEnglish && (
            <p className={styles.note}>No English voice found on this device. Install one in Android Settings → Text-to-speech.</p>
          )}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="theme-heading">
        <h2 id="theme-heading" className={styles.sectionTitle}>
          Appearance
        </h2>
        <div className={`card ${styles.box}`}>
          <Segmented name="theme" label="Theme" value={settings.theme} options={THEMES} onChange={(v) => void saveSetting('theme', v)} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="backup-heading">
        <h2 id="backup-heading" className={styles.sectionTitle}>
          Backup
        </h2>
        <div className={`card ${styles.box}`}>
          <p className={styles.note}>Your sets are stored only on this device. Export a backup now and then.</p>
          <div className={styles.buttons}>
            <Button variant="outline" icon={<Download size={20} />} onClick={() => void exportBackup()}>
              Export backup
            </Button>
            <Button variant="outline" icon={<Upload size={20} />} onClick={() => fileInput.current?.click()}>
              Import backup
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            tabIndex={-1}
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          {importError && (
            <p className={styles.error} role="alert">
              {importError}
            </p>
          )}
          {pending && (
            <InlineConfirm
              message={`Import ${plural(pending.sets.length, 'set')} and ${plural(pending.cards.length, 'card')}? Sets that already exist on this device will be replaced.`}
              confirmLabel="Import"
              onConfirm={() => void confirmImport()}
              onCancel={() => setPending(null)}
            />
          )}
        </div>
      </section>

      {canInstall && (
        <section className={styles.section} aria-labelledby="install-heading">
          <h2 id="install-heading" className={styles.sectionTitle}>
            App
          </h2>
          <div className={`card ${styles.box}`}>
            <Button icon={<Smartphone size={20} />} onClick={() => void install()}>
              Install Quizly
            </Button>
          </div>
        </section>
      )}

      <footer className={styles.about}>
        <span>Quizly {__APP_VERSION__}</span>
        <a href="https://github.com/Onddrej/quizly" target="_blank" rel="noreferrer">
          Source on GitHub
        </a>
      </footer>
    </Page>
  );
}
