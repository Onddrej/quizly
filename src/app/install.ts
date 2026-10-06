import { useCallback, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Call once at startup: Chrome fires beforeinstallprompt early, before React renders the Settings page. */
export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<void> } {
  const canInstall = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const install = useCallback(async () => {
    const event = deferred;
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    deferred = null;
    notify();
  }, []);
  return { canInstall, install };
}
