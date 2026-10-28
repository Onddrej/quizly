import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { saveSetting } from '../../db/settings';
import { isValidTime } from '../../lib/reminder';
import { disableReminder, enableReminder, notificationPermission, reminderSupport, showTestNotification, type EnableFailure } from '../../lib/reminderSetup';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { useToast } from '../../ui/Toast';
import styles from './Streak.module.css';

const FAILURES: Record<EnableFailure, string> = {
  'permission-denied': "Notifications are blocked for Quizly. Allow them in the site settings of your browser, then try again.",
  'not-installed': 'Add Quizly to your home screen first, then switch the reminder on from the installed app.',
  unsupported: 'Reminders work in Chrome on Android, with Quizly installed on the home screen.',
  error: "Couldn't switch the reminder on. Try again.",
};

/** The daily reminder: a switch, the time of day, and what to do when the browser cannot or will not deliver it. */
export function ReminderCard() {
  const { reminder } = useSettings();
  const toast = useToast();
  const [failure, setFailure] = useState<EnableFailure | null>(null);
  const [time, setTime] = useState(reminder.time);
  const [testing, setTesting] = useState(false);
  const supported = reminderSupport().ok;
  const blocked = notificationPermission() === 'denied';

  const message = !supported ? FAILURES.unsupported : failure ? FAILURES[failure] : blocked && reminder.enabled ? FAILURES['permission-denied'] : null;

  async function toggle(enabled: boolean) {
    setFailure(null);
    try {
      if (enabled) {
        const result = await enableReminder();
        if (!result.ok) {
          setFailure(result.reason);
          return;
        }
      } else {
        await disableReminder();
      }
      await saveSetting('reminder', { ...reminder, enabled });
    } catch {
      setFailure('error');
    }
  }

  function changeTime(value: string) {
    setTime(value);
    if (isValidTime(value)) void saveSetting('reminder', { ...reminder, time: value }).catch(() => toast("Couldn't save. Try again."));
  }

  async function sendTest() {
    setTesting(true);
    setFailure(null);
    try {
      if (await showTestNotification()) toast('Test notification sent');
      else toast("Couldn't show a notification. Check the notification settings of Quizly.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className={`card ${styles.reminder}`} aria-labelledby="reminder-heading">
      <h2 id="reminder-heading" className={styles.reminderTitle}>
        <Bell size={18} aria-hidden="true" />
        Daily reminder
      </h2>
      <Switch id="reminder-enabled" label="Remind me to learn" checked={reminder.enabled && !blocked} disabled={!supported} onChange={(v) => void toggle(v)} />
      <div className={styles.timeRow}>
        <label htmlFor="reminder-time">Reminder time</label>
        <input id="reminder-time" type="time" className={styles.time} value={time} disabled={!supported} onChange={(e) => changeTime(e.target.value)} />
      </div>
      {message ? <p className={styles.reminderError}>{message}</p> : <p className={styles.hint}>Skipped on days you have already finished a round. Chrome picks the exact moment, so it can arrive a few hours after this time.</p>}
      {reminder.enabled && !blocked && supported && (
        <Button variant="outline" disabled={testing} onClick={() => void sendTest()}>
          Send a test notification
        </Button>
      )}
    </section>
  );
}
