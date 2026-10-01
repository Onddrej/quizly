import { db } from '../db/schema';

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()));
}
