import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, INITIAL_SCHEMA_SQL } from '@/db/schema';

interface TableInfoRow {
  name: string;
}

async function hasTableColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName})`);

  return rows.some((row) => row.name === columnName);
}

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(INITIAL_SCHEMA_SQL);

  const hasBirthDate = await hasTableColumn(db, 'child_profile', 'birth_date');

  if (!hasBirthDate) {
    await db.execAsync('ALTER TABLE child_profile ADD COLUMN birth_date TEXT');
  }

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
