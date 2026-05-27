import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import {
  formatSleepDayDateKey,
  getSleepDayDateKeyForDate,
  getSleepDayDateKeysForInterval,
} from '@/core/sleepDay';
import { buildSleepPlanPreset } from '@/core/sleepPlan';
import type {
  ChildProfile,
  SleepDayPlan,
  SleepDayPlanSnapshot,
  SleepKind,
  SleepPlanPreset,
  SleepSession,
  TargetDayPlan,
} from '@/types/sleep';

interface SaveSleepSessionInput {
  kind: SleepKind;
  startedAt: Date;
  endedAt: Date | null;
}

interface SleepSessionRow {
  id: string;
  child_id: string;
  kind: SleepKind;
  started_at: string;
  ended_at: string | null;
}

interface ChildProfileRow {
  id: string;
  name: string;
  birth_date: string | null;
  photo_uri: string | null;
  created_at: string;
}

interface TargetDayPlanRow {
  id: string;
  child_id: string;
  name: string | null;
  is_active: number | null;
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
  updated_at: string;
}

interface SleepDayPlanSnapshotRow {
  child_id: string;
  sleep_day_date: string;
  source_plan_id: string | null;
  source_plan_name: string;
  day_start_minutes: number;
  wake_up_start_minutes: number;
  wake_up_end_minutes: number;
  target_awake_min_minutes: number;
  target_awake_max_minutes: number;
  target_awake_minutes: number;
  nap_count: number;
  target_day_sleep_min_minutes: number;
  target_day_sleep_max_minutes: number;
  target_day_sleep_minutes: number;
  bedtime_target_minutes: number;
  early_bedtime_minutes: number;
  latest_evening_nap_end_minutes: number;
  max_evening_nap_minutes: number;
  min_night_sleep_minutes: number;
  micro_nap_minutes: number;
  captured_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface SaveChildProfileInput {
  name: string;
  birthDate: string | null;
}

interface TableInfoRow {
  name: string;
}

const DEFAULT_TARGET_DAY_PLAN_ID = 'default-target-day-plan';
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

function createLocalId(prefix: string, date: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `${prefix}-${date.getTime()}-${randomPart}`;
}

function mapSleepSessionRow(row: SleepSessionRow): SleepSession {
  return {
    id: row.id,
    childId: row.child_id,
    kind: row.kind,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapChildProfileRow(row: ChildProfileRow): ChildProfile {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
  };
}

function coalesceNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapTargetDayPlanPreset(row: TargetDayPlanRow): SleepPlanPreset {
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

function mapTargetDayPlanRow(row: TargetDayPlanRow): TargetDayPlan {
  return {
    childId: row.child_id,
    id: row.id,
    isActive: row.is_active === 1,
    name: row.name?.trim() || DEFAULT_TARGET_DAY_PLAN_NAME,
    plan: mapTargetDayPlanPreset(row),
    updatedAt: row.updated_at,
  };
}

function mapSleepDayPlanSnapshotPreset(row: SleepDayPlanSnapshotRow): SleepPlanPreset {
  const builtPlan = buildSleepPlanPreset({
    latestEveningNapEndMinutes: row.latest_evening_nap_end_minutes,
    maxEveningNapMinutes: row.max_evening_nap_minutes,
    microNapMinutes: row.micro_nap_minutes,
    minNightSleepMinutes: row.min_night_sleep_minutes,
    napCount: row.nap_count,
    targetAwakeMaxMinutes: row.target_awake_max_minutes,
    targetAwakeMinMinutes: row.target_awake_min_minutes,
    targetDaySleepMaxMinutes: row.target_day_sleep_max_minutes,
    targetDaySleepMinMinutes: row.target_day_sleep_min_minutes,
    wakeUpEndMinutes: row.wake_up_end_minutes,
    wakeUpStartMinutes: row.wake_up_start_minutes,
  });

  return {
    ...builtPlan,
    bedtimeTargetMinutes: row.bedtime_target_minutes,
    dayStartMinutes: row.day_start_minutes,
    earlyBedtimeMinutes: row.early_bedtime_minutes,
    targetAwakeMinutes: row.target_awake_minutes,
    targetDaySleepMinutes: row.target_day_sleep_minutes,
  };
}

function mapSleepDayPlanSnapshotRow(row: SleepDayPlanSnapshotRow): SleepDayPlanSnapshot {
  return {
    capturedAt: row.captured_at,
    childId: row.child_id,
    plan: mapSleepDayPlanSnapshotPreset(row),
    sleepDayDate: row.sleep_day_date,
    sourcePlanId: row.source_plan_id,
    sourcePlanName: row.source_plan_name,
    updatedAt: row.updated_at,
  };
}

function mapTargetPlanToSleepDayPlan(
  targetPlan: TargetDayPlan,
  sleepDayDate: string,
): SleepDayPlan {
  return {
    childId: targetPlan.childId,
    isSnapshot: false,
    plan: targetPlan.plan,
    sleepDayDate,
    sourcePlanId: targetPlan.id,
    sourcePlanName: targetPlan.name,
  };
}

function mapSnapshotToSleepDayPlan(snapshot: SleepDayPlanSnapshot): SleepDayPlan {
  return {
    childId: snapshot.childId,
    isSnapshot: true,
    plan: snapshot.plan,
    sleepDayDate: snapshot.sleepDayDate,
    sourcePlanId: snapshot.sourcePlanId,
    sourcePlanName: snapshot.sourcePlanName,
  };
}

function normalizeTargetPlanName(name: string): string {
  const trimmedName = name.trim();

  return trimmedName.length > 0 ? trimmedName.slice(0, 40) : DEFAULT_TARGET_DAY_PLAN_NAME;
}

async function ensureChildProfileColumns(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<TableInfoRow>('PRAGMA table_info(child_profile)');
  const columnNames = new Set(rows.map((row) => row.name));

  for (const column of CHILD_PROFILE_COLUMNS) {
    if (!columnNames.has(column.name)) {
      await db.execAsync(`ALTER TABLE child_profile ADD COLUMN ${column.definition}`);
    }
  }
}

async function ensureTargetDayPlanColumns(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<TableInfoRow>('PRAGMA table_info(target_day_plan)');
  const columnNames = new Set(rows.map((row) => row.name));

  for (const column of TARGET_DAY_PLAN_COLUMNS) {
    if (!columnNames.has(column.name)) {
      await db.execAsync(`ALTER TABLE target_day_plan ADD COLUMN ${column.definition}`);
    }
  }
}

async function ensureSleepDayPlanSnapshotTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(SLEEP_DAY_PLAN_SNAPSHOT_TABLE_SQL);
}

async function normalizeTargetDayPlans(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await db.runAsync(
    `
    UPDATE target_day_plan
    SET name = ?
    WHERE child_id = ? AND (name IS NULL OR TRIM(name) = '')
    `,
    [DEFAULT_TARGET_DAY_PLAN_NAME, childId],
  );
  await db.runAsync(
    `
    UPDATE target_day_plan
    SET is_active = 0
    WHERE child_id = ? AND is_active IS NULL
    `,
    [childId],
  );

  const activeRows = await db.getAllAsync<{ id: string }>(
    `
    SELECT id
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    ORDER BY updated_at DESC
    `,
    [childId],
  );

  if (activeRows.length === 0) {
    const firstRow = await db.getFirstAsync<{ id: string }>(
      `
      SELECT id
      FROM target_day_plan
      WHERE child_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [childId],
    );

    if (firstRow) {
      await db.runAsync('UPDATE target_day_plan SET is_active = 1 WHERE id = ? AND child_id = ?', [
        firstRow.id,
        childId,
      ]);
    }
  }

  if (activeRows.length > 1) {
    const [activeRowToKeep] = activeRows;

    await db.runAsync(
      `
      UPDATE target_day_plan
      SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
      WHERE child_id = ?
      `,
      [activeRowToKeep.id, childId],
    );
  }
}

export async function ensureDefaultChildProfile(db: SQLiteDatabase): Promise<void> {
  await ensureChildProfileColumns(db);

  await db.runAsync(
    `
    INSERT OR IGNORE INTO child_profile (id, name, birth_date, photo_uri, created_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    [DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, null, null, new Date().toISOString()],
  );
}

export async function ensureSleepDayPlanSnapshotStorage(db: SQLiteDatabase): Promise<void> {
  await ensureSleepDayPlanSnapshotTable(db);
}

async function ensureDefaultTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);
  await ensureTargetDayPlanColumns(db);
  await ensureSleepDayPlanSnapshotTable(db);
  await normalizeTargetDayPlans(db, childId);

  const existingRow = await db.getFirstAsync<{ id: string }>(
    `
    SELECT id
    FROM target_day_plan
    WHERE child_id = ?
    LIMIT 1
    `,
    [childId],
  );

  if (existingRow) {
    return;
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO target_day_plan (
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      DEFAULT_TARGET_DAY_PLAN_ID,
      childId,
      DEFAULT_TARGET_DAY_PLAN_NAME,
      1,
      DEFAULT_SLEEP_PLAN.wakeUpStartMinutes,
      DEFAULT_SLEEP_PLAN.wakeUpEndMinutes,
      DEFAULT_SLEEP_PLAN.targetAwakeMinMinutes,
      DEFAULT_SLEEP_PLAN.targetAwakeMaxMinutes,
      DEFAULT_SLEEP_PLAN.targetAwakeMinutes,
      DEFAULT_SLEEP_PLAN.napCount,
      DEFAULT_SLEEP_PLAN.targetDaySleepMinMinutes,
      DEFAULT_SLEEP_PLAN.targetDaySleepMaxMinutes,
      DEFAULT_SLEEP_PLAN.targetDaySleepMinutes,
      DEFAULT_SLEEP_PLAN.bedtimeTargetMinutes,
      now,
    ],
  );
}

async function selectTargetDayPlanById(
  db: SQLiteDatabase,
  planId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan | null> {
  const row = await db.getFirstAsync<TargetDayPlanRow>(
    `
    SELECT
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    FROM target_day_plan
    WHERE id = ? AND child_id = ?
    LIMIT 1
    `,
    [planId, childId],
  );

  return row ? mapTargetDayPlanRow(row) : null;
}

async function selectSleepDayPlanSnapshot(
  db: SQLiteDatabase,
  sleepDayDate: string,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepDayPlanSnapshot | null> {
  await ensureSleepDayPlanSnapshotTable(db);

  const row = await db.getFirstAsync<SleepDayPlanSnapshotRow>(
    `
    SELECT
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
    FROM sleep_day_plan_snapshot
    WHERE child_id = ? AND sleep_day_date = ?
    LIMIT 1
    `,
    [childId, sleepDayDate],
  );

  return row ? mapSleepDayPlanSnapshotRow(row) : null;
}

async function upsertSleepDayPlanSnapshotFromTargetPlan(
  db: SQLiteDatabase,
  sleepDayDate: string,
  targetPlan: TargetDayPlan,
): Promise<void> {
  await ensureSleepDayPlanSnapshotTable(db);

  const now = new Date().toISOString();

  await db.runAsync(
    `
    INSERT INTO sleep_day_plan_snapshot (
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
    ON CONFLICT(child_id, sleep_day_date) DO UPDATE SET
      source_plan_id = excluded.source_plan_id,
      source_plan_name = excluded.source_plan_name,
      day_start_minutes = excluded.day_start_minutes,
      wake_up_start_minutes = excluded.wake_up_start_minutes,
      wake_up_end_minutes = excluded.wake_up_end_minutes,
      target_awake_min_minutes = excluded.target_awake_min_minutes,
      target_awake_max_minutes = excluded.target_awake_max_minutes,
      target_awake_minutes = excluded.target_awake_minutes,
      nap_count = excluded.nap_count,
      target_day_sleep_min_minutes = excluded.target_day_sleep_min_minutes,
      target_day_sleep_max_minutes = excluded.target_day_sleep_max_minutes,
      target_day_sleep_minutes = excluded.target_day_sleep_minutes,
      bedtime_target_minutes = excluded.bedtime_target_minutes,
      early_bedtime_minutes = excluded.early_bedtime_minutes,
      latest_evening_nap_end_minutes = excluded.latest_evening_nap_end_minutes,
      max_evening_nap_minutes = excluded.max_evening_nap_minutes,
      min_night_sleep_minutes = excluded.min_night_sleep_minutes,
      micro_nap_minutes = excluded.micro_nap_minutes,
      updated_at = excluded.updated_at
    `,
    [
      targetPlan.childId,
      sleepDayDate,
      targetPlan.id,
      targetPlan.name,
      targetPlan.plan.dayStartMinutes,
      targetPlan.plan.wakeUpStartMinutes,
      targetPlan.plan.wakeUpEndMinutes,
      targetPlan.plan.targetAwakeMinMinutes,
      targetPlan.plan.targetAwakeMaxMinutes,
      targetPlan.plan.targetAwakeMinutes,
      targetPlan.plan.napCount,
      targetPlan.plan.targetDaySleepMinMinutes,
      targetPlan.plan.targetDaySleepMaxMinutes,
      targetPlan.plan.targetDaySleepMinutes,
      targetPlan.plan.bedtimeTargetMinutes,
      targetPlan.plan.earlyBedtimeMinutes,
      targetPlan.plan.latestEveningNapEndMinutes,
      targetPlan.plan.maxEveningNapMinutes,
      targetPlan.plan.minNightSleepMinutes,
      targetPlan.plan.microNapMinutes,
      now,
      now,
    ],
  );
}

async function getActiveTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  const row = await db.getFirstAsync<TargetDayPlanRow>(
    `
    SELECT
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [childId],
  );

  if (row) {
    return mapTargetDayPlanRow(row);
  }

  return {
    childId,
    id: DEFAULT_TARGET_DAY_PLAN_ID,
    isActive: true,
    name: DEFAULT_TARGET_DAY_PLAN_NAME,
    plan: DEFAULT_SLEEP_PLAN,
    updatedAt: new Date().toISOString(),
  };
}

async function upsertCurrentSleepDayPlanSnapshot(
  db: SQLiteDatabase,
  targetPlan: TargetDayPlan,
): Promise<void> {
  const sleepDayDate = getSleepDayDateKeyForDate(new Date(), targetPlan.plan);

  await upsertSleepDayPlanSnapshotFromTargetPlan(db, sleepDayDate, targetPlan);
}

async function ensureSleepDayPlanSnapshotsForSession(
  db: SQLiteDatabase,
  session: SleepSession,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  const activePlan = await getActiveTargetDayPlan(db, childId);
  const currentSleepDayDate = getSleepDayDateKeyForDate(new Date(), activePlan.plan);
  const sleepDayDates = getSleepDayDateKeysForInterval(
    new Date(session.startedAt),
    session.endedAt ? new Date(session.endedAt) : null,
    activePlan.plan,
  );

  for (const sleepDayDate of sleepDayDates) {
    const existingSnapshot = await selectSleepDayPlanSnapshot(db, sleepDayDate, childId);

    if (!existingSnapshot || sleepDayDate === currentSleepDayDate) {
      await upsertSleepDayPlanSnapshotFromTargetPlan(db, sleepDayDate, activePlan);
    }
  }
}

export async function listTargetDayPlans(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan[]> {
  await ensureDefaultTargetDayPlan(db, childId);

  const rows = await db.getAllAsync<TargetDayPlanRow>(
    `
    SELECT
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    FROM target_day_plan
    WHERE child_id = ?
    ORDER BY is_active DESC, updated_at DESC
    `,
    [childId],
  );

  return rows.map(mapTargetDayPlanRow);
}

export async function getTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepPlanPreset> {
  await ensureDefaultTargetDayPlan(db, childId);

  const row = await db.getFirstAsync<TargetDayPlanRow>(
    `
    SELECT
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [childId],
  );

  return row ? mapTargetDayPlanPreset(row) : DEFAULT_SLEEP_PLAN;
}

export async function getSleepDayPlan(
  db: SQLiteDatabase,
  selectedDate: Date,
  now: Date,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepDayPlan> {
  const activePlan = await getActiveTargetDayPlan(db, childId);
  const selectedDateKey = formatSleepDayDateKey(selectedDate);
  const nowDateKey = formatSleepDayDateKey(now);

  if (selectedDateKey === nowDateKey) {
    return mapTargetPlanToSleepDayPlan(
      activePlan,
      getSleepDayDateKeyForDate(now, activePlan.plan),
    );
  }

  if (selectedDate.getTime() > now.getTime()) {
    return mapTargetPlanToSleepDayPlan(activePlan, selectedDateKey);
  }

  const snapshot = await selectSleepDayPlanSnapshot(db, selectedDateKey, childId);

  return snapshot
    ? mapSnapshotToSleepDayPlan(snapshot)
    : mapTargetPlanToSleepDayPlan(activePlan, selectedDateKey);
}

export async function assignSleepDayPlanSnapshot(
  db: SQLiteDatabase,
  selectedDate: Date,
  targetPlanId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  const targetPlan = await selectTargetDayPlanById(db, targetPlanId, childId);

  if (!targetPlan) {
    throw new Error('Target day plan was not found');
  }

  const sleepDayDate = formatSleepDayDateKey(selectedDate);

  await upsertSleepDayPlanSnapshotFromTargetPlan(db, sleepDayDate, targetPlan);

  const snapshot = await selectSleepDayPlanSnapshot(db, sleepDayDate, childId);

  if (!snapshot) {
    throw new Error('Sleep day plan snapshot was not saved');
  }

  return mapSnapshotToSleepDayPlan(snapshot);
}

export async function createTargetDayPlan(
  db: SQLiteDatabase,
  input: { name: string; plan: SleepPlanPreset },
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  const now = new Date();
  const planId = createLocalId('target-day-plan', now);
  const updatedAt = now.toISOString();

  await db.runAsync(
    `
    INSERT INTO target_day_plan (
      id,
      child_id,
      name,
      is_active,
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
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      planId,
      childId,
      normalizeTargetPlanName(input.name),
      0,
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
      updatedAt,
    ],
  );

  const createdPlan = await selectTargetDayPlanById(db, planId, childId);

  if (!createdPlan) {
    throw new Error('Target day plan was not created');
  }

  return createdPlan;
}

export async function updateTargetDayPlan(
  db: SQLiteDatabase,
  planId: string,
  input: { name: string; plan: SleepPlanPreset },
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  await db.runAsync(
    `
    UPDATE target_day_plan
    SET
      name = ?,
      wake_up_start_minutes = ?,
      wake_up_end_minutes = ?,
      target_awake_min_minutes = ?,
      target_awake_max_minutes = ?,
      target_awake_minutes = ?,
      nap_count = ?,
      target_day_sleep_min_minutes = ?,
      target_day_sleep_max_minutes = ?,
      target_day_sleep_minutes = ?,
      bedtime_target_minutes = ?,
      updated_at = ?
    WHERE id = ? AND child_id = ?
    `,
    [
      normalizeTargetPlanName(input.name),
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
      new Date().toISOString(),
      planId,
      childId,
    ],
  );

  const updatedPlan = await selectTargetDayPlanById(db, planId, childId);

  if (!updatedPlan) {
    throw new Error('Target day plan was not updated');
  }

  if (updatedPlan.isActive) {
    await upsertCurrentSleepDayPlanSnapshot(db, updatedPlan);
  }

  return updatedPlan;
}

export async function saveTargetDayPlan(
  db: SQLiteDatabase,
  plan: SleepPlanPreset,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  const plans = await listTargetDayPlans(db, childId);
  const activePlan = plans.find((targetPlan) => targetPlan.isActive) ?? plans[0];

  if (!activePlan) {
    return;
  }

  await updateTargetDayPlan(db, activePlan.id, { name: activePlan.name, plan }, childId);
}

export async function activateTargetDayPlan(
  db: SQLiteDatabase,
  planId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  const existingPlan = await selectTargetDayPlanById(db, planId, childId);

  if (!existingPlan) {
    throw new Error('Target day plan was not found');
  }

  await db.runAsync(
    `
    UPDATE target_day_plan
    SET
      is_active = CASE WHEN id = ? THEN 1 ELSE 0 END,
      updated_at = CASE WHEN id = ? THEN ? ELSE updated_at END
    WHERE child_id = ?
    `,
    [planId, planId, new Date().toISOString(), childId],
  );

  const activePlan = await selectTargetDayPlanById(db, planId, childId);

  if (!activePlan) {
    throw new Error('Target day plan was not activated');
  }

  await upsertCurrentSleepDayPlanSnapshot(db, activePlan);

  return activePlan;
}

export async function deleteTargetDayPlan(
  db: SQLiteDatabase,
  planId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<TargetDayPlan> {
  await ensureDefaultTargetDayPlan(db, childId);

  const existingPlan = await selectTargetDayPlanById(db, planId, childId);

  if (!existingPlan) {
    throw new Error('Target day plan was not found');
  }

  const countRow = await db.getFirstAsync<CountRow>(
    `
    SELECT COUNT(*) AS count
    FROM target_day_plan
    WHERE child_id = ?
    `,
    [childId],
  );

  if ((countRow?.count ?? 0) <= 1) {
    throw new Error('Cannot delete the only target day plan');
  }

  await db.runAsync(
    `
    DELETE FROM target_day_plan
    WHERE id = ? AND child_id = ?
    `,
    [planId, childId],
  );

  if (existingPlan.isActive) {
    const nextPlanRow = await db.getFirstAsync<{ id: string }>(
      `
      SELECT id
      FROM target_day_plan
      WHERE child_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [childId],
    );

    if (!nextPlanRow) {
      throw new Error('Next target day plan was not found');
    }

    return activateTargetDayPlan(db, nextPlanRow.id, childId);
  }

  const activePlanRow = await db.getFirstAsync<{ id: string }>(
    `
    SELECT id
    FROM target_day_plan
    WHERE child_id = ? AND is_active = 1
    LIMIT 1
    `,
    [childId],
  );

  if (!activePlanRow) {
    throw new Error('Active target day plan was not found');
  }

  const activePlan = await selectTargetDayPlanById(db, activePlanRow.id, childId);

  if (!activePlan) {
    throw new Error('Active target day plan was not found');
  }

  return activePlan;
}

export async function getChildProfile(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<ChildProfile> {
  await ensureDefaultChildProfile(db);

  const row = await db.getFirstAsync<ChildProfileRow>(
    `
    SELECT id, name, birth_date, photo_uri, created_at
    FROM child_profile
    WHERE id = ?
    LIMIT 1
    `,
    [childId],
  );

  if (row) {
    return mapChildProfileRow(row);
  }

  return {
    id: childId,
    name: DEFAULT_CHILD_NAME,
    birthDate: null,
    photoUri: null,
    createdAt: new Date().toISOString(),
  };
}

export async function updateChildProfile(
  db: SQLiteDatabase,
  input: SaveChildProfileInput,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);

  await db.runAsync(
    `
    UPDATE child_profile
    SET name = ?, birth_date = ?
    WHERE id = ?
    `,
    [input.name.trim(), input.birthDate, childId],
  );
}

export async function updateChildProfileName(
  db: SQLiteDatabase,
  name: string,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);

  await db.runAsync(
    `
    UPDATE child_profile
    SET name = ?
    WHERE id = ?
    `,
    [name.trim(), childId],
  );
}

export async function updateChildProfilePhotoUri(
  db: SQLiteDatabase,
  photoUri: string | null,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);

  await db.runAsync(
    `
    UPDATE child_profile
    SET photo_uri = ?
    WHERE id = ?
    `,
    [photoUri, childId],
  );
}

export async function getActiveSleepSession(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession | null> {
  const row = await db.getFirstAsync<SleepSessionRow>(
    `
    SELECT id, child_id, kind, started_at, ended_at
    FROM sleep_sessions
    WHERE child_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [childId],
  );

  return row ? mapSleepSessionRow(row) : null;
}

export async function getLatestSleepSession(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession | null> {
  const row = await db.getFirstAsync<SleepSessionRow>(
    `
    SELECT id, child_id, kind, started_at, ended_at
    FROM sleep_sessions
    WHERE child_id = ?
    ORDER BY started_at DESC
    LIMIT 1
    `,
    [childId],
  );

  return row ? mapSleepSessionRow(row) : null;
}

export async function listSleepSessionsInRange(
  db: SQLiteDatabase,
  rangeStart: Date,
  rangeEnd: Date,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession[]> {
  const rangeStartIso = rangeStart.toISOString();
  const rangeEndIso = rangeEnd.toISOString();
  const rows = await db.getAllAsync<SleepSessionRow>(
    `
    SELECT id, child_id, kind, started_at, ended_at
    FROM sleep_sessions
    WHERE child_id = ?
      AND (
        (started_at >= ? AND started_at < ?)
        OR (ended_at IS NULL AND started_at < ?)
        OR (ended_at IS NOT NULL AND ended_at > ? AND started_at < ?)
      )
    ORDER BY started_at ASC
    `,
    [childId, rangeStartIso, rangeEndIso, rangeEndIso, rangeStartIso, rangeEndIso],
  );

  return rows.map(mapSleepSessionRow);
}

export async function backfillMissingSleepDayPlanSnapshots(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultTargetDayPlan(db, childId);

  const rows = await db.getAllAsync<SleepSessionRow>(
    `
    SELECT id, child_id, kind, started_at, ended_at
    FROM sleep_sessions
    WHERE child_id = ?
    ORDER BY started_at ASC
    `,
    [childId],
  );

  for (const row of rows) {
    await ensureSleepDayPlanSnapshotsForSession(db, mapSleepSessionRow(row), childId);
  }
}

export async function startSleepSession(
  db: SQLiteDatabase,
  kind: SleepKind,
  startedAt: Date,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession> {
  await ensureDefaultChildProfile(db);

  const activeSession = await getActiveSleepSession(db, childId);

  if (activeSession) {
    return activeSession;
  }

  const session: SleepSession = {
    id: createLocalId('sleep', startedAt),
    childId,
    kind,
    startedAt: startedAt.toISOString(),
    endedAt: null,
  };

  await db.runAsync(
    `
    INSERT INTO sleep_sessions (id, child_id, kind, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    [session.id, session.childId, session.kind, session.startedAt, session.endedAt],
  );

  await ensureSleepDayPlanSnapshotsForSession(db, session, childId);

  return session;
}

export async function createSleepSession(
  db: SQLiteDatabase,
  input: SaveSleepSessionInput,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession> {
  await ensureDefaultChildProfile(db);

  const session: SleepSession = {
    id: createLocalId('sleep', input.startedAt),
    childId,
    kind: input.kind,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt ? input.endedAt.toISOString() : null,
  };

  await db.runAsync(
    `
    INSERT INTO sleep_sessions (id, child_id, kind, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?)
    `,
    [session.id, session.childId, session.kind, session.startedAt, session.endedAt],
  );

  await ensureSleepDayPlanSnapshotsForSession(db, session, childId);

  return session;
}

export async function updateSleepSession(
  db: SQLiteDatabase,
  sessionId: string,
  input: SaveSleepSessionInput,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await db.runAsync(
    `
    UPDATE sleep_sessions
    SET kind = ?, started_at = ?, ended_at = ?
    WHERE id = ? AND child_id = ?
    `,
    [
      input.kind,
      input.startedAt.toISOString(),
      input.endedAt ? input.endedAt.toISOString() : null,
      sessionId,
      childId,
    ],
  );

  await ensureSleepDayPlanSnapshotsForSession(
    db,
    {
      childId,
      endedAt: input.endedAt ? input.endedAt.toISOString() : null,
      id: sessionId,
      kind: input.kind,
      startedAt: input.startedAt.toISOString(),
    },
    childId,
  );
}

export async function deleteSleepSession(
  db: SQLiteDatabase,
  sessionId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await db.runAsync(
    `
    DELETE FROM sleep_sessions
    WHERE id = ? AND child_id = ?
    `,
    [sessionId, childId],
  );
}

export async function stopActiveSleepSession(
  db: SQLiteDatabase,
  endedAt: Date,
  kind?: SleepKind,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepSession | null> {
  const activeSession = await getActiveSleepSession(db, childId);

  if (!activeSession) {
    return null;
  }

  const endedAtIso = endedAt.toISOString();

  await db.runAsync(
    `
    UPDATE sleep_sessions
    SET ended_at = ?, kind = ?
    WHERE id = ? AND child_id = ? AND ended_at IS NULL
    `,
    [endedAtIso, kind ?? activeSession.kind, activeSession.id, childId],
  );

  const stoppedSession = {
    ...activeSession,
    kind: kind ?? activeSession.kind,
    endedAt: endedAtIso,
  };

  await ensureSleepDayPlanSnapshotsForSession(db, stoppedSession, childId);

  return stoppedSession;
}
