import { useCallback, useRef, useSyncExternalStore } from 'react';

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
  const prompting = useRef(false);
  const install = useCallback(async () => {
    const event = deferred;
    if (!event || prompting.current) return;
    prompting.current = true;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // The browser refused the prompt (for example it was already used): there is nothing left to offer either way.
    } finally {
      prompting.current = false;
      deferred = null;
      notify();
    }
  }, []);
  return { canInstall, install };
}
