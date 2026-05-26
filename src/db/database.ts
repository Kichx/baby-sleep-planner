import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, INITIAL_SCHEMA_SQL } from '@/db/schema';

interface TableInfoRow {
  name: string;
}

const TARGET_DAY_PLAN_COLUMNS = [
  'wake_up_start_minutes',
  'wake_up_end_minutes',
  'target_awake_min_minutes',
  'target_awake_max_minutes',
  'nap_count',
  'target_day_sleep_min_minutes',
  'target_day_sleep_max_minutes',
] as const;

async function hasTableColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await db.getAllAsync<TableInfoRow>(`PRAGMA table_info(${tableName})`);

  return rows.some((row) => row.name === columnName);
}

async function ensureTargetDayPlanColumns(db: SQLiteDatabase): Promise<void> {
  for (const columnName of TARGET_DAY_PLAN_COLUMNS) {
    const hasColumn = await hasTableColumn(db, 'target_day_plan', columnName);

    if (!hasColumn) {
      await db.execAsync(`ALTER TABLE target_day_plan ADD COLUMN ${columnName} INTEGER`);
    }
  }
}

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(INITIAL_SCHEMA_SQL);

  const hasBirthDate = await hasTableColumn(db, 'child_profile', 'birth_date');

  if (!hasBirthDate) {
    await db.execAsync('ALTER TABLE child_profile ADD COLUMN birth_date TEXT');
  }

  await ensureTargetDayPlanColumns(db);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
