import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, INITIAL_SCHEMA_SQL } from '@/db/schema';

interface TableInfoRow {
  name: string;
}

interface TargetDayPlanIdRow {
  id: string;
}

const TARGET_DAY_PLAN_COLUMNS = [
  { definition: 'name TEXT', name: 'name' },
  { definition: 'is_active INTEGER', name: 'is_active' },
  { definition: 'wake_up_start_minutes INTEGER', name: 'wake_up_start_minutes' },
  { definition: 'wake_up_end_minutes INTEGER', name: 'wake_up_end_minutes' },
  { definition: 'target_awake_min_minutes INTEGER', name: 'target_awake_min_minutes' },
  { definition: 'target_awake_max_minutes INTEGER', name: 'target_awake_max_minutes' },
  { definition: 'nap_count INTEGER', name: 'nap_count' },
  { definition: 'target_day_sleep_min_minutes INTEGER', name: 'target_day_sleep_min_minutes' },
  { definition: 'target_day_sleep_max_minutes INTEGER', name: 'target_day_sleep_max_minutes' },
] as const;

const CHILD_PROFILE_COLUMNS = [
  { definition: 'birth_date TEXT', name: 'birth_date' },
  { definition: 'photo_uri TEXT', name: 'photo_uri' },
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
  for (const column of TARGET_DAY_PLAN_COLUMNS) {
    const hasColumn = await hasTableColumn(db, 'target_day_plan', column.name);

    if (!hasColumn) {
      await db.execAsync(`ALTER TABLE target_day_plan ADD COLUMN ${column.definition}`);
    }
  }
}

async function ensureChildProfileColumns(db: SQLiteDatabase): Promise<void> {
  for (const column of CHILD_PROFILE_COLUMNS) {
    const hasColumn = await hasTableColumn(db, 'child_profile', column.name);

    if (!hasColumn) {
      await db.execAsync(`ALTER TABLE child_profile ADD COLUMN ${column.definition}`);
    }
  }
}

async function normalizeTargetDayPlans(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `
    UPDATE target_day_plan
    SET name = ?
    WHERE name IS NULL OR TRIM(name) = ''
    `,
    ['Основной'],
  );
  await db.runAsync(
    `
    UPDATE target_day_plan
    SET is_active = 0
    WHERE is_active IS NULL
    `,
  );

  const activeRows = await db.getAllAsync<TargetDayPlanIdRow>(
    `
    SELECT id
    FROM target_day_plan
    WHERE is_active = 1
    ORDER BY updated_at DESC
    `,
  );

  if (activeRows.length === 0) {
    const firstRow = await db.getFirstAsync<TargetDayPlanIdRow>(
      `
      SELECT id
      FROM target_day_plan
      ORDER BY updated_at DESC
      LIMIT 1
      `,
    );

    if (firstRow) {
      await db.runAsync('UPDATE target_day_plan SET is_active = 1 WHERE id = ?', [firstRow.id]);
    }
  }

  if (activeRows.length > 1) {
    const [activeRowToKeep] = activeRows;

    await db.runAsync(
      `
      UPDATE target_day_plan
      SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
      `,
      [activeRowToKeep.id],
    );
  }
}

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(INITIAL_SCHEMA_SQL);

  await ensureChildProfileColumns(db);
  await ensureTargetDayPlanColumns(db);
  await normalizeTargetDayPlans(db);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
