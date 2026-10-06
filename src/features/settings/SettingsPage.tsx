import { useRef, useState } from 'react';
import { Download, Smartphone, Upload, Volume2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useInstallPrompt } from '../../app/install';
import { saveSetting } from '../../db/settings';
import { BackupError, backupFileName, countExistingSets, createBackup, importBackup, parseBackup, serializeBackup, type Backup } from '../../db/backup';
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

/** Sets are never lost silently: the preview says how many sets on this device the import overwrites. */
function replaceNote(replaced: number): string {
  if (replaced === 0) return 'Nothing on this device will be replaced.';
  if (replaced === 1) return '1 set is already on this device and will be replaced, including its progress.';
  return `${replaced} sets are already on this device and will be replaced, including their progress.`;
}

export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const speech = useSpeech();
  const { canInstall, install } = useInstallPrompt();
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<{ backup: Backup; replaced: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function exportBackup() {
    setExporting(true);
    try {
      downloadText(backupFileName(new Date()), serializeBackup(await createBackup()));
      toast('Backup downloaded');
    } catch {
      toast("Couldn't export. Try again.");
    } finally {
      setExporting(false);
    }
  }

  async function onFile(file: File) {
    setImportError(null);
    setPending(null);
    try {
      const backup = parseBackup(await readFileText(file));
      setPending({ backup, replaced: await countExistingSets(backup) });
    } catch (error) {
      setImportError(error instanceof BackupError ? error.message : "Couldn't read this file.");
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setImportError(null);
    try {
      const result = await importBackup(pending.backup);
      setPending(null);
      importButton.current?.focus();
      toast(`Imported ${plural(result.sets, 'set')}`);
    } catch {
      setImportError("Couldn't import. Nothing was changed.");
    }
  }

  function closePreview() {
    setPending(null);
    setImportError(null);
    importButton.current?.focus();
  }

  return (
    <Page top={<TopBar title="Settings" />} bottom={<TabBar />}>
      <section className={styles.section} aria-labelledby="pronunciation-heading">
        <h2 id="pronunciation-heading" className={styles.sectionTitle}>
          Pronunciation
        </h2>
        <div className={`card ${styles.box}`}>
          <Segmented name="accent" label="Accent" value={settings.accent} options={ACCENTS} onChange={(v) => void saveSetting('accent', v).catch(() => toast("Couldn't save. Try again."))} />
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
          <Segmented name="theme" label="Theme" value={settings.theme} options={THEMES} onChange={(v) => void saveSetting('theme', v).catch(() => toast("Couldn't save. Try again."))} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="backup-heading">
        <h2 id="backup-heading" className={styles.sectionTitle}>
          Backup
        </h2>
        <div className={`card ${styles.box}`}>
          <p className={styles.note}>Your sets are stored only on this device. Export a backup now and then.</p>
          <div className={styles.buttons}>
            <Button variant="outline" icon={<Download size={20} />} disabled={exporting} onClick={() => void exportBackup()}>
              Export backup
            </Button>
            <Button ref={importButton} variant="outline" icon={<Upload size={20} />} onClick={() => fileInput.current?.click()}>
              Import backup
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
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
              message={`Import ${plural(pending.backup.sets.length, 'set')} and ${plural(pending.backup.cards.length, 'card')}? ${replaceNote(pending.replaced)}`}
              confirmLabel="Import"
              onConfirm={() => void confirmImport()}
              onCancel={closePreview}
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
