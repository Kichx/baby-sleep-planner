import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildSleepPlanPreset } from '@/core/sleepPlan';
import type {
  ChildProfile,
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

async function ensureDefaultTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);
  await ensureTargetDayPlanColumns(db);
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

  return {
    ...activeSession,
    kind: kind ?? activeSession.kind,
    endedAt: endedAtIso,
  };
}
