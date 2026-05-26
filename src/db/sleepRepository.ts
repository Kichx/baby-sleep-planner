import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { buildSleepPlanPreset } from '@/core/sleepPlan';
import type { ChildProfile, SleepKind, SleepPlanPreset, SleepSession } from '@/types/sleep';

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
  created_at: string;
}

interface TargetDayPlanRow {
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

interface SaveChildProfileInput {
  name: string;
  birthDate: string | null;
}

interface TableInfoRow {
  name: string;
}

const TARGET_DAY_PLAN_ID = 'default-target-day-plan';
const TARGET_DAY_PLAN_COLUMNS = [
  'wake_up_start_minutes',
  'wake_up_end_minutes',
  'target_awake_min_minutes',
  'target_awake_max_minutes',
  'nap_count',
  'target_day_sleep_min_minutes',
  'target_day_sleep_max_minutes',
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
    createdAt: row.created_at,
  };
}

function coalesceNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function mapTargetDayPlanRow(row: TargetDayPlanRow): SleepPlanPreset {
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

async function ensureChildProfileBirthDateColumn(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<TableInfoRow>('PRAGMA table_info(child_profile)');
  const hasBirthDate = rows.some((row) => row.name === 'birth_date');

  if (!hasBirthDate) {
    await db.execAsync('ALTER TABLE child_profile ADD COLUMN birth_date TEXT');
  }
}

async function ensureTargetDayPlanColumns(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<TableInfoRow>('PRAGMA table_info(target_day_plan)');
  const columnNames = new Set(rows.map((row) => row.name));

  for (const columnName of TARGET_DAY_PLAN_COLUMNS) {
    if (!columnNames.has(columnName)) {
      await db.execAsync(`ALTER TABLE target_day_plan ADD COLUMN ${columnName} INTEGER`);
    }
  }
}

export async function ensureDefaultChildProfile(db: SQLiteDatabase): Promise<void> {
  await ensureChildProfileBirthDateColumn(db);

  await db.runAsync(
    `
    INSERT OR IGNORE INTO child_profile (id, name, birth_date, created_at)
    VALUES (?, ?, ?, ?)
    `,
    [DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, null, new Date().toISOString()],
  );
}

export async function getTargetDayPlan(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<SleepPlanPreset> {
  await ensureDefaultChildProfile(db);
  await ensureTargetDayPlanColumns(db);

  const row = await db.getFirstAsync<TargetDayPlanRow>(
    `
    SELECT
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
    WHERE id = ? AND child_id = ?
    LIMIT 1
    `,
    [TARGET_DAY_PLAN_ID, childId],
  );

  return row ? mapTargetDayPlanRow(row) : DEFAULT_SLEEP_PLAN;
}

export async function saveTargetDayPlan(
  db: SQLiteDatabase,
  plan: SleepPlanPreset,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await ensureDefaultChildProfile(db);
  await ensureTargetDayPlanColumns(db);

  await db.runAsync(
    `
    INSERT OR REPLACE INTO target_day_plan (
      id,
      child_id,
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      TARGET_DAY_PLAN_ID,
      childId,
      plan.wakeUpStartMinutes,
      plan.wakeUpEndMinutes,
      plan.targetAwakeMinMinutes,
      plan.targetAwakeMaxMinutes,
      plan.targetAwakeMinutes,
      plan.napCount,
      plan.targetDaySleepMinMinutes,
      plan.targetDaySleepMaxMinutes,
      plan.targetDaySleepMinutes,
      plan.bedtimeTargetMinutes,
      new Date().toISOString(),
    ],
  );
}

export async function getChildProfile(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<ChildProfile> {
  await ensureDefaultChildProfile(db);

  const row = await db.getFirstAsync<ChildProfileRow>(
    `
    SELECT id, name, birth_date, created_at
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
