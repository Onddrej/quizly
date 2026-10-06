import type { Table } from 'dexie';
import { diagnostics } from '../lib/diagnostics';
import { db } from './schema';

/**
 * A Dexie transaction that lands in the diagnostics log when it fails or is slow. The `body` checkpoint is the moment the
 * transaction body finished: a total far above it means the commit (the disk flush) was slow, not the work itself.
 */
export function tracedTransaction<T>(op: string, mode: 'r' | 'rw', tables: Table[], body: () => Promise<T>): Promise<T> {
  return diagnostics.trace(op, (checkpoint) =>
    db.transaction(mode, tables, async () => {
      try {
        return await body();
      } finally {
        checkpoint('body');
      }
    }),
  );
}
