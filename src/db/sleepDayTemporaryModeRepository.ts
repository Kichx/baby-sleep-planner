import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID } from '@/constants/sleep';
import { SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL } from '@/db/schema';
import { ensureDefaultChildProfile } from '@/db/sleepRepository';
import type { SleepDayTemporaryMode, SleepDayTemporaryModeType } from '@/types/sleep';

interface SleepDayTemporaryModeRow {
  id: string;
  child_id: string;
  sleep_day_date_key: string;
  mode: SleepDayTemporaryModeType;
  base_plan_id: string;
  created_at: string;
  disabled_at: string | null;
  dismissed_at: string | null;
}

function createLocalId(prefix: string, date: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `${prefix}-${date.getTime()}-${randomPart}`;
}

function assertValidSleepDayDateKey(sleepDayDateKey: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sleepDayDateKey);

  if (!match) {
    throw new Error('Sleep day date key must use YYYY-MM-DD format');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error('Sleep day date key must be a valid date');
  }
}

function assertValidTemporaryMode(mode: SleepDayTemporaryModeType): void {
  if (mode !== 'soft_day' && mode !== 'early_wake') {
    throw new Error('Sleep day temporary mode is not supported');
  }
}

function assertValidBasePlanId(basePlanId: string): void {
  if (basePlanId.trim().length === 0) {
    throw new Error('Temporary mode base plan id must not be empty');
  }
}

function mapSleepDayTemporaryModeRow(row: SleepDayTemporaryModeRow): SleepDayTemporaryMode {
  return {
    basePlanId: row.base_plan_id,
    childId: row.child_id,
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
    dismissedAt: row.dismissed_at,
    id: row.id,
    mode: row.mode,
    sleepDayDateKey: row.sleep_day_date_key,
  };
}

async function ensureSleepDayTemporaryModeStorage(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL);
}

async function selectSleepDayTemporaryMode(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
  mode: SleepDayTemporaryModeType,
): Promise<SleepDayTemporaryMode | null> {
  const row = await db.getFirstAsync<SleepDayTemporaryModeRow>(
    `
    SELECT
      id,
      child_id,
      sleep_day_date_key,
      mode,
      base_plan_id,
      created_at,
      disabled_at,
      dismissed_at
    FROM sleep_day_temporary_mode
    WHERE child_id = ? AND sleep_day_date_key = ? AND mode = ?
    LIMIT 1
    `,
    [childId, sleepDayDateKey, mode],
  );

  return row ? mapSleepDayTemporaryModeRow(row) : null;
}

async function getActiveBasePlanId(db: SQLiteDatabase, childId: string): Promise<string> {
  const row = await db.getFirstAsync<{ id: string }>(
    `
    SELECT id
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    ORDER BY updated_at DESC, id ASC
    LIMIT 1
    `,
    [childId],
  );

  if (!row) {
    throw new Error('Active target day plan was not found');
  }

  return row.id;
}

export async function listSleepDayTemporaryModes(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
): Promise<SleepDayTemporaryMode[]> {
  assertValidSleepDayDateKey(sleepDayDateKey);
  await ensureSleepDayTemporaryModeStorage(db);

  const rows = await db.getAllAsync<SleepDayTemporaryModeRow>(
    `
    SELECT
      id,
      child_id,
      sleep_day_date_key,
      mode,
      base_plan_id,
      created_at,
      disabled_at,
      dismissed_at
    FROM sleep_day_temporary_mode
    WHERE child_id = ? AND sleep_day_date_key = ?
    ORDER BY created_at ASC, mode ASC
    `,
    [childId, sleepDayDateKey],
  );

  return rows.map(mapSleepDayTemporaryModeRow);
}

export async function enableSleepDayTemporaryMode(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
  mode: SleepDayTemporaryModeType,
  basePlanId: string,
): Promise<SleepDayTemporaryMode> {
  assertValidSleepDayDateKey(sleepDayDateKey);
  assertValidTemporaryMode(mode);
  assertValidBasePlanId(basePlanId);
  await ensureDefaultChildProfile(db);
  await ensureSleepDayTemporaryModeStorage(db);

  const existingMode = await selectSleepDayTemporaryMode(db, childId, sleepDayDateKey, mode);

  if (existingMode) {
    await db.runAsync(
      `
      UPDATE sleep_day_temporary_mode
      SET base_plan_id = ?, disabled_at = NULL, dismissed_at = NULL
      WHERE child_id = ? AND sleep_day_date_key = ? AND mode = ?
      `,
      [basePlanId, childId, sleepDayDateKey, mode],
    );

    const enabledMode = await selectSleepDayTemporaryMode(db, childId, sleepDayDateKey, mode);

    if (!enabledMode) {
      throw new Error('Sleep day temporary mode was not enabled');
    }

    return enabledMode;
  }

  const now = new Date();
  const temporaryMode: SleepDayTemporaryMode = {
    basePlanId,
    childId,
    createdAt: now.toISOString(),
    disabledAt: null,
    dismissedAt: null,
    id: createLocalId('sleep-day-temporary-mode', now),
    mode,
    sleepDayDateKey,
  };

  await db.runAsync(
    `
    INSERT INTO sleep_day_temporary_mode (
      id,
      child_id,
      sleep_day_date_key,
      mode,
      base_plan_id,
      created_at,
      disabled_at,
      dismissed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      temporaryMode.id,
      temporaryMode.childId,
      temporaryMode.sleepDayDateKey,
      temporaryMode.mode,
      temporaryMode.basePlanId,
      temporaryMode.createdAt,
      temporaryMode.disabledAt,
      temporaryMode.dismissedAt,
    ],
  );

  return temporaryMode;
}

export async function disableSleepDayTemporaryMode(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
  mode: SleepDayTemporaryModeType,
): Promise<void> {
  assertValidSleepDayDateKey(sleepDayDateKey);
  assertValidTemporaryMode(mode);
  await ensureSleepDayTemporaryModeStorage(db);

  await db.runAsync(
    `
    UPDATE sleep_day_temporary_mode
    SET disabled_at = ?
    WHERE child_id = ? AND sleep_day_date_key = ? AND mode = ?
    `,
    [new Date().toISOString(), childId, sleepDayDateKey, mode],
  );
}

export async function disableAllSleepDayTemporaryModes(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
): Promise<void> {
  assertValidSleepDayDateKey(sleepDayDateKey);
  await ensureSleepDayTemporaryModeStorage(db);

  await db.runAsync(
    `
    UPDATE sleep_day_temporary_mode
    SET disabled_at = ?
    WHERE child_id = ? AND sleep_day_date_key = ?
    `,
    [new Date().toISOString(), childId, sleepDayDateKey],
  );
}

export async function dismissSleepDayTemporaryModeSuggestion(
  db: SQLiteDatabase,
  childId: string,
  sleepDayDateKey: string,
  mode: SleepDayTemporaryModeType,
): Promise<void> {
  assertValidSleepDayDateKey(sleepDayDateKey);
  assertValidTemporaryMode(mode);
  await ensureDefaultChildProfile(db);
  await ensureSleepDayTemporaryModeStorage(db);

  const dismissedAt = new Date().toISOString();
  const existingMode = await selectSleepDayTemporaryMode(db, childId, sleepDayDateKey, mode);

  if (existingMode) {
    await db.runAsync(
      `
      UPDATE sleep_day_temporary_mode
      SET dismissed_at = ?
      WHERE child_id = ? AND sleep_day_date_key = ? AND mode = ?
      `,
      [dismissedAt, childId, sleepDayDateKey, mode],
    );

    return;
  }

  const now = new Date();
  const basePlanId = await getActiveBasePlanId(db, childId);

  await db.runAsync(
    `
    INSERT INTO sleep_day_temporary_mode (
      id,
      child_id,
      sleep_day_date_key,
      mode,
      base_plan_id,
      created_at,
      disabled_at,
      dismissed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      createLocalId('sleep-day-temporary-mode', now),
      childId,
      sleepDayDateKey,
      mode,
      basePlanId,
      now.toISOString(),
      dismissedAt,
      dismissedAt,
    ],
  );
}
