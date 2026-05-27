import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { getSleepDayDateKeysForInterval } from '@/core/sleepDay';
import { buildSleepPlanPreset } from '@/core/sleepPlan';
import { DATABASE_VERSION, INITIAL_SCHEMA_SQL } from '@/db/schema';
import type { SleepPlanPreset } from '@/types/sleep';

interface TableInfoRow {
  name: string;
}

interface TargetDayPlanIdRow {
  id: string;
}

interface TargetDayPlanSnapshotSourceRow {
  id: string;
  child_id: string;
  name: string | null;
  wake_up_start_minutes: number | null;
  wake_up_end_minutes: number | null;
  target_awake_min_minutes: number | null;
  target_awake_max_minutes: number | null;
  target_awake_minutes: number;
  nap_count: number | null;
  target_day_sleep_min_minutes: number | null;
  target_day_sleep_max_minutes: number | null;
  target_day_sleep_minutes: number;
  bedtime_target_minutes: number;
}

interface SleepSessionSnapshotSeedRow {
  child_id: string;
  started_at: string;
  ended_at: string | null;
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

const DEFAULT_TARGET_DAY_PLAN_NAME = 'Основной';

const SLEEP_DAY_PLAN_SNAPSHOT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS sleep_day_plan_snapshot (
  child_id TEXT NOT NULL,
  sleep_day_date TEXT NOT NULL,
  source_plan_id TEXT,
  source_plan_name TEXT NOT NULL,
  day_start_minutes INTEGER NOT NULL,
  wake_up_start_minutes INTEGER NOT NULL,
  wake_up_end_minutes INTEGER NOT NULL,
  target_awake_min_minutes INTEGER NOT NULL,
  target_awake_max_minutes INTEGER NOT NULL,
  target_awake_minutes INTEGER NOT NULL,
  nap_count INTEGER NOT NULL,
  target_day_sleep_min_minutes INTEGER NOT NULL,
  target_day_sleep_max_minutes INTEGER NOT NULL,
  target_day_sleep_minutes INTEGER NOT NULL,
  bedtime_target_minutes INTEGER NOT NULL,
  early_bedtime_minutes INTEGER NOT NULL,
  latest_evening_nap_end_minutes INTEGER NOT NULL,
  max_evening_nap_minutes INTEGER NOT NULL,
  min_night_sleep_minutes INTEGER NOT NULL,
  micro_nap_minutes INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, sleep_day_date),
  FOREIGN KEY (child_id) REFERENCES child_profile(id)
);
`;

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

async function ensureSleepDayPlanSnapshotTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SLEEP_DAY_PLAN_SNAPSHOT_TABLE_SQL);
}

function coalesceNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapTargetDayPlanPreset(row: TargetDayPlanSnapshotSourceRow): SleepPlanPreset {
  const targetAwakeMinutes = coalesceNumber(
    row.target_awake_minutes,
    DEFAULT_SLEEP_PLAN.targetAwakeMinutes,
  );
  const targetDaySleepMinutes = coalesceNumber(
    row.target_day_sleep_minutes,
    DEFAULT_SLEEP_PLAN.targetDaySleepMinutes,
  );
  const legacyWakeUpMinutes =
    row.bedtime_target_minutes - targetAwakeMinutes - targetDaySleepMinutes;
  const canUseLegacyWakeUp = legacyWakeUpMinutes >= 0 && legacyWakeUpMinutes < 24 * 60;
  const wakeUpStartMinutes = coalesceNumber(
    row.wake_up_start_minutes,
    canUseLegacyWakeUp ? legacyWakeUpMinutes : DEFAULT_SLEEP_PLAN.wakeUpStartMinutes,
  );

  return buildSleepPlanPreset({
    latestEveningNapEndMinutes: DEFAULT_SLEEP_PLAN.latestEveningNapEndMinutes,
    maxEveningNapMinutes: DEFAULT_SLEEP_PLAN.maxEveningNapMinutes,
    microNapMinutes: DEFAULT_SLEEP_PLAN.microNapMinutes,
    minNightSleepMinutes: DEFAULT_SLEEP_PLAN.minNightSleepMinutes,
    napCount: coalesceNumber(row.nap_count, DEFAULT_SLEEP_PLAN.napCount),
    targetAwakeMaxMinutes: coalesceNumber(row.target_awake_max_minutes, targetAwakeMinutes),
    targetAwakeMinMinutes: coalesceNumber(row.target_awake_min_minutes, targetAwakeMinutes),
    targetDaySleepMaxMinutes: coalesceNumber(
      row.target_day_sleep_max_minutes,
      targetDaySleepMinutes,
    ),
    targetDaySleepMinMinutes: coalesceNumber(
      row.target_day_sleep_min_minutes,
      targetDaySleepMinutes,
    ),
    wakeUpEndMinutes: coalesceNumber(row.wake_up_end_minutes, wakeUpStartMinutes),
    wakeUpStartMinutes,
  });
}

async function insertSnapshotIfMissing(
  db: SQLiteDatabase,
  input: {
    childId: string;
    sleepDayDate: string;
    sourcePlanId: string | null;
    sourcePlanName: string;
    plan: SleepPlanPreset;
    capturedAt: string;
  },
): Promise<void> {
  await db.runAsync(
    `
    INSERT OR IGNORE INTO sleep_day_plan_snapshot (
      child_id,
      sleep_day_date,
      source_plan_id,
      source_plan_name,
      day_start_minutes,
      wake_up_start_minutes,
      wake_up_end_minutes,
      target_awake_min_minutes,
      target_awake_max_minutes,
      target_awake_minutes,
      nap_count,
      target_day_sleep_min_minutes,
      target_day_sleep_max_minutes,
      target_day_sleep_minutes,
      bedtime_target_minutes,
      early_bedtime_minutes,
      latest_evening_nap_end_minutes,
      max_evening_nap_minutes,
      min_night_sleep_minutes,
      micro_nap_minutes,
      captured_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.childId,
      input.sleepDayDate,
      input.sourcePlanId,
      input.sourcePlanName,
      input.plan.dayStartMinutes,
      input.plan.wakeUpStartMinutes,
      input.plan.wakeUpEndMinutes,
      input.plan.targetAwakeMinMinutes,
      input.plan.targetAwakeMaxMinutes,
      input.plan.targetAwakeMinutes,
      input.plan.napCount,
      input.plan.targetDaySleepMinMinutes,
      input.plan.targetDaySleepMaxMinutes,
      input.plan.targetDaySleepMinutes,
      input.plan.bedtimeTargetMinutes,
      input.plan.earlyBedtimeMinutes,
      input.plan.latestEveningNapEndMinutes,
      input.plan.maxEveningNapMinutes,
      input.plan.minNightSleepMinutes,
      input.plan.microNapMinutes,
      input.capturedAt,
      input.capturedAt,
    ],
  );
}

async function backfillSleepDayPlanSnapshots(db: SQLiteDatabase): Promise<void> {
  const sessions = await db.getAllAsync<SleepSessionSnapshotSeedRow>(
    `
    SELECT child_id, started_at, ended_at
    FROM sleep_sessions
    ORDER BY started_at ASC
    `,
  );

  if (sessions.length === 0) {
    return;
  }

  const planRows = await db.getAllAsync<TargetDayPlanSnapshotSourceRow>(
    `
    SELECT
      id,
      child_id,
      name,
      wake_up_start_minutes,
      wake_up_end_minutes,
      target_awake_min_minutes,
      target_awake_max_minutes,
      target_awake_minutes,
      nap_count,
      target_day_sleep_min_minutes,
      target_day_sleep_max_minutes,
      target_day_sleep_minutes,
      bedtime_target_minutes
    FROM target_day_plan
    WHERE is_active = 1
    ORDER BY updated_at DESC
    `,
  );
  const activePlanByChildId = new Map(
    planRows.map((row) => [
      row.child_id,
      {
        plan: mapTargetDayPlanPreset(row),
        sourcePlanId: row.id,
        sourcePlanName: row.name?.trim() || DEFAULT_TARGET_DAY_PLAN_NAME,
      },
    ]),
  );
  const capturedAt = new Date().toISOString();

  for (const session of sessions) {
    const activePlan = activePlanByChildId.get(session.child_id) ?? {
      plan: DEFAULT_SLEEP_PLAN,
      sourcePlanId: null,
      sourcePlanName: DEFAULT_TARGET_DAY_PLAN_NAME,
    };
    const sleepDayDates = getSleepDayDateKeysForInterval(
      new Date(session.started_at),
      session.ended_at ? new Date(session.ended_at) : null,
      activePlan.plan,
    );

    for (const sleepDayDate of sleepDayDates) {
      await insertSnapshotIfMissing(db, {
        capturedAt,
        childId: session.child_id,
        plan: activePlan.plan,
        sleepDayDate,
        sourcePlanId: activePlan.sourcePlanId,
        sourcePlanName: activePlan.sourcePlanName,
      });
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
  await ensureSleepDayPlanSnapshotTable(db);
  await normalizeTargetDayPlans(db);
  await backfillSleepDayPlanSnapshots(db);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
