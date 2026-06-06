import type { SQLiteDatabase } from 'expo-sqlite';

import { INITIAL_SCHEMA_SQL } from '@/db/schema';

type ResetTransaction = Pick<SQLiteDatabase, 'runAsync'>;

interface ExclusiveTransactionDatabase {
  withExclusiveTransactionAsync?: (
    task: (txn: ResetTransaction) => Promise<void>,
  ) => Promise<void>;
}

async function runResetTransaction(
  db: SQLiteDatabase,
  task: (txn: ResetTransaction) => Promise<void>,
): Promise<void> {
  const exclusiveDb = db as unknown as ExclusiveTransactionDatabase;

  if (typeof exclusiveDb.withExclusiveTransactionAsync === 'function') {
    await exclusiveDb.withExclusiveTransactionAsync((txn) => task(txn));
    return;
  }

  await db.withTransactionAsync(() => task(db));
}

export async function resetApplicationData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(INITIAL_SCHEMA_SQL);

  await runResetTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM sleep_day_temporary_mode');
    await txn.runAsync('DELETE FROM sleep_day_plan_snapshot');
    await txn.runAsync('DELETE FROM target_day_plan');
    await txn.runAsync('DELETE FROM bottle_feedings');
    await txn.runAsync('DELETE FROM sleep_sessions');
    await txn.runAsync('DELETE FROM app_settings');
    await txn.runAsync('DELETE FROM child_profile');
  });
}
