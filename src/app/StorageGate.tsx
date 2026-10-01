import { useEffect, useState, type ReactNode } from 'react';
import { openDatabase } from '../db/schema';
import { Page } from '../ui/Page';
import { EmptyState } from '../ui/EmptyState';

/** IndexedDB is unavailable in some private modes; without it Quizly cannot work (spec 10). */
export function StorageGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'failed'>('checking');

  useEffect(() => {
    openDatabase()
      .then(() => setState('ok'))
      .catch(() => setState('failed'));
  }, []);

  if (state === 'checking') return null;
  if (state === 'failed') {
    return (
      <Page>
        <EmptyState title="Quizly can't save data in this browser mode" text="Open it in a normal window." />
      </Page>
    );
  }
  return <>{children}</>;
}
