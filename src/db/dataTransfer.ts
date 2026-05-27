import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID } from '@/constants/sleep';
import { DATABASE_VERSION } from '@/db/schema';
import { ensureDefaultChildProfile, getTargetDayPlan } from '@/db/sleepRepository';
import type { SleepKind } from '@/types/sleep';

export const APP_DATA_BACKUP_FORMAT = 'baby-sleep-planner-backup';
export const APP_DATA_BACKUP_FORMAT_VERSION = 1;
export const APP_DATA_BACKUP_MIME_TYPE = 'application/json';

type DataTransferErrorCode = 'invalid-json' | 'unsupported-format' | 'invalid-data';

interface ChildProfileBackupRow {
  id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
}

interface SleepSessionBackupRow {
  id: string;
  child_id: string;
  kind: SleepKind;
  started_at: string;
  ended_at: string | null;
}

interface TargetDayPlanBackupRow {
  id: string;
  child_id: string;
  name: string;
  is_active: number;
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

export interface AppDataBackup {
  format: typeof APP_DATA_BACKUP_FORMAT;
  formatVersion: typeof APP_DATA_BACKUP_FORMAT_VERSION;
  databaseVersion: number;
  exportedAt: string;
  data: {
    childProfiles: ChildProfileBackupRow[];
    sleepSessions: SleepSessionBackupRow[];
    targetDayPlans: TargetDayPlanBackupRow[];
  };
}

export interface AppDataRestoreSummary {
  childProfiles: number;
  sleepSessions: number;
  targetDayPlans: number;
}

export class DataTransferError extends Error {
  code: DataTransferErrorCode;

  constructor(code: DataTransferErrorCode, message: string) {
    super(message);
    this.name = 'DataTransferError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failInvalidData(message: string): never {
  throw new DataTransferError('invalid-data', message);
}

function readString(row: Record<string, unknown>, fieldName: string): string {
  const value = row[fieldName];

  if (typeof value !== 'string' || value.trim().length === 0) {
    failInvalidData(`Invalid string field: ${fieldName}`);
  }

  return value;
}

function readNullableString(row: Record<string, unknown>, fieldName: string): string | null {
  const value = row[fieldName];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    failInvalidData(`Invalid nullable string field: ${fieldName}`);
  }

  return value;
}

function readInteger(row: Record<string, unknown>, fieldName: string): number {
  const value = row[fieldName];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    failInvalidData(`Invalid integer field: ${fieldName}`);
  }

  return value;
}

function readNullableInteger(row: Record<string, unknown>, fieldName: string): number | null {
  const value = row[fieldName];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    failInvalidData(`Invalid nullable integer field: ${fieldName}`);
  }

  return value;
}

function readIsoDateString(row: Record<string, unknown>, fieldName: string): string {
  const value = readString(row, fieldName);

  if (Number.isNaN(new Date(value).getTime())) {
    failInvalidData(`Invalid date field: ${fieldName}`);
  }

  return value;
}

function readNullableIsoDateString(
  row: Record<string, unknown>,
  fieldName: string,
): string | null {
  const value = readNullableString(row, fieldName);

  if (value !== null && Number.isNaN(new Date(value).getTime())) {
    failInvalidData(`Invalid nullable date field: ${fieldName}`);
  }

  return value;
}

function readSleepKind(row: Record<string, unknown>): SleepKind {
  const value = row.kind;

  if (value !== 'nap' && value !== 'night') {
    failInvalidData('Invalid sleep kind');
  }

  return value;
}

function readActiveFlag(row: Record<string, unknown>): number {
  const value = readInteger(row, 'is_active');

  if (value !== 0 && value !== 1) {
    failInvalidData('Invalid active plan flag');
  }

  return value;
}

function assertRecordArray(value: unknown, label: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    failInvalidData(`Invalid ${label} array`);
  }

  return value;
}

function assertUniqueIds(rows: { id: string }[], label: string): void {
  const ids = new Set<string>();

  for (const row of rows) {
    if (ids.has(row.id)) {
      failInvalidData(`Duplicate ${label} id`);
    }

    ids.add(row.id);
  }
}

function parseChildProfiles(value: unknown): ChildProfileBackupRow[] {
  const rows = assertRecordArray(value, 'childProfiles').map((row) => ({
    birth_date: readNullableString(row, 'birth_date'),
    created_at: readIsoDateString(row, 'created_at'),
    id: readString(row, 'id'),
    name: readString(row, 'name'),
  }));

  if (rows.length === 0) {
    failInvalidData('Backup has no child profile');
  }

  assertUniqueIds(rows, 'child profile');

  if (!rows.some((row) => row.id === DEFAULT_CHILD_ID)) {
    failInvalidData('Backup has no default child profile');
  }

  return rows;
}

function parseSleepSessions(
  value: unknown,
  childProfileIds: Set<string>,
): SleepSessionBackupRow[] {
  const rows = assertRecordArray(value, 'sleepSessions').map((row) => {
    const startedAt = readIsoDateString(row, 'started_at');
    const endedAt = readNullableIsoDateString(row, 'ended_at');
    const childId = readString(row, 'child_id');

    if (!childProfileIds.has(childId)) {
      failInvalidData('Sleep session references an unknown child profile');
    }

    if (endedAt && new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
      failInvalidData('Sleep session ends before it starts');
    }

    return {
      child_id: childId,
      ended_at: endedAt,
      id: readString(row, 'id'),
      kind: readSleepKind(row),
      started_at: startedAt,
    };
  });

  assertUniqueIds(rows, 'sleep session');

  return rows;
}

function parseTargetDayPlans(
  value: unknown,
  childProfileIds: Set<string>,
): TargetDayPlanBackupRow[] {
  const rows = assertRecordArray(value, 'targetDayPlans').map((row) => {
    const childId = readString(row, 'child_id');

    if (!childProfileIds.has(childId)) {
      failInvalidData('Target day plan references an unknown child profile');
    }

    return {
      bedtime_target_minutes: readInteger(row, 'bedtime_target_minutes'),
      child_id: childId,
      id: readString(row, 'id'),
      is_active: readActiveFlag(row),
      name: readString(row, 'name'),
      nap_count: readNullableInteger(row, 'nap_count'),
      target_awake_max_minutes: readNullableInteger(row, 'target_awake_max_minutes'),
      target_awake_min_minutes: readNullableInteger(row, 'target_awake_min_minutes'),
      target_awake_minutes: readInteger(row, 'target_awake_minutes'),
      target_day_sleep_max_minutes: readNullableInteger(row, 'target_day_sleep_max_minutes'),
      target_day_sleep_min_minutes: readNullableInteger(row, 'target_day_sleep_min_minutes'),
      target_day_sleep_minutes: readInteger(row, 'target_day_sleep_minutes'),
      updated_at: readIsoDateString(row, 'updated_at'),
      wake_up_end_minutes: readNullableInteger(row, 'wake_up_end_minutes'),
      wake_up_start_minutes: readNullableInteger(row, 'wake_up_start_minutes'),
    };
  });

  if (rows.length === 0) {
    failInvalidData('Backup has no target day plan');
  }

  assertUniqueIds(rows, 'target day plan');

  return rows;
}

function normalizeBackup(value: unknown): AppDataBackup {
  if (!isRecord(value)) {
    throw new DataTransferError('unsupported-format', 'Backup root must be an object');
  }

  if (
    value.format !== APP_DATA_BACKUP_FORMAT ||
    value.formatVersion !== APP_DATA_BACKUP_FORMAT_VERSION
  ) {
    throw new DataTransferError('unsupported-format', 'Unsupported backup format');
  }

  const databaseVersion = readInteger(value, 'databaseVersion');
  const exportedAt = readIsoDateString(value, 'exportedAt');
  const data = value.data;

  if (!isRecord(data)) {
    failInvalidData('Invalid backup data');
  }

  const childProfiles = parseChildProfiles(data.childProfiles);
  const childProfileIds = new Set(childProfiles.map((profile) => profile.id));
  const sleepSessions = parseSleepSessions(data.sleepSessions, childProfileIds);
  const targetDayPlans = parseTargetDayPlans(data.targetDayPlans, childProfileIds);

  return {
    data: {
      childProfiles,
      sleepSessions,
      targetDayPlans,
    },
    databaseVersion,
    exportedAt,
    format: APP_DATA_BACKUP_FORMAT,
    formatVersion: APP_DATA_BACKUP_FORMAT_VERSION,
  };
}

async function normalizeImportedTargetDayPlans(db: SQLiteDatabase): Promise<void> {
  const childProfileRows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM child_profile ORDER BY created_at ASC, id ASC',
  );

  for (const childProfile of childProfileRows) {
    const activeRows = await db.getAllAsync<{ id: string }>(
      `
      SELECT id
      FROM target_day_plan
      WHERE child_id = ? AND is_active = 1
      ORDER BY updated_at DESC, id ASC
      `,
      [childProfile.id],
    );

    if (activeRows.length === 0) {
      const firstPlan = await db.getFirstAsync<{ id: string }>(
        `
        SELECT id
        FROM target_day_plan
        WHERE child_id = ?
        ORDER BY updated_at DESC, id ASC
        LIMIT 1
        `,
        [childProfile.id],
      );

      if (firstPlan) {
        await db.runAsync(
          'UPDATE target_day_plan SET is_active = 1 WHERE id = ? AND child_id = ?',
          [firstPlan.id, childProfile.id],
        );
      }

      continue;
    }

    if (activeRows.length > 1) {
      const [activePlanToKeep] = activeRows;

      await db.runAsync(
        `
        UPDATE target_day_plan
        SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
        WHERE child_id = ?
        `,
        [activePlanToKeep.id, childProfile.id],
      );
    }
  }
}

export async function buildAppDataBackup(db: SQLiteDatabase): Promise<AppDataBackup> {
  await ensureDefaultChildProfile(db);
  await getTargetDayPlan(db);

  const childProfiles = await db.getAllAsync<ChildProfileBackupRow>(
    `
    SELECT id, name, birth_date, created_at
    FROM child_profile
    ORDER BY created_at ASC, id ASC
    `,
  );
  const sleepSessions = await db.getAllAsync<SleepSessionBackupRow>(
    `
    SELECT id, child_id, kind, started_at, ended_at
    FROM sleep_sessions
    ORDER BY started_at ASC, id ASC
    `,
  );
  const targetDayPlans = await db.getAllAsync<TargetDayPlanBackupRow>(
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
    ORDER BY is_active DESC, updated_at DESC, id ASC
    `,
  );

  return normalizeBackup({
    data: {
      childProfiles,
      sleepSessions,
      targetDayPlans,
    },
    databaseVersion: DATABASE_VERSION,
    exportedAt: new Date().toISOString(),
    format: APP_DATA_BACKUP_FORMAT,
    formatVersion: APP_DATA_BACKUP_FORMAT_VERSION,
  });
}

export function parseAppDataBackup(content: string): AppDataBackup {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(content);
  } catch {
    throw new DataTransferError('invalid-json', 'Backup file is not valid JSON');
  }

  return normalizeBackup(parsedContent);
}

export function serializeAppDataBackup(backup: AppDataBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export async function restoreAppDataBackup(
  db: SQLiteDatabase,
  backup: AppDataBackup,
): Promise<AppDataRestoreSummary> {
  const normalizedBackup = normalizeBackup(backup);

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM target_day_plan');
    await db.runAsync('DELETE FROM sleep_sessions');
    await db.runAsync('DELETE FROM child_profile');

    for (const profile of normalizedBackup.data.childProfiles) {
      await db.runAsync(
        `
        INSERT INTO child_profile (id, name, birth_date, created_at)
        VALUES (?, ?, ?, ?)
        `,
        [profile.id, profile.name, profile.birth_date, profile.created_at],
      );
    }

    for (const session of normalizedBackup.data.sleepSessions) {
      await db.runAsync(
        `
        INSERT INTO sleep_sessions (id, child_id, kind, started_at, ended_at)
        VALUES (?, ?, ?, ?, ?)
        `,
        [session.id, session.child_id, session.kind, session.started_at, session.ended_at],
      );
    }

    for (const plan of normalizedBackup.data.targetDayPlans) {
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
          plan.id,
          plan.child_id,
          plan.name,
          plan.is_active,
          plan.wake_up_start_minutes,
          plan.wake_up_end_minutes,
          plan.target_awake_min_minutes,
          plan.target_awake_max_minutes,
          plan.target_awake_minutes,
          plan.nap_count,
          plan.target_day_sleep_min_minutes,
          plan.target_day_sleep_max_minutes,
          plan.target_day_sleep_minutes,
          plan.bedtime_target_minutes,
          plan.updated_at,
        ],
      );
    }

    await normalizeImportedTargetDayPlans(db);
  });

  return {
    childProfiles: normalizedBackup.data.childProfiles.length,
    sleepSessions: normalizedBackup.data.sleepSessions.length,
    targetDayPlans: normalizedBackup.data.targetDayPlans.length,
  };
}
