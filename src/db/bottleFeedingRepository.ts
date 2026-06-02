import type { SQLiteDatabase } from 'expo-sqlite';

import { MAX_BOTTLE_FEEDING_VOLUME_ML } from '@/constants/bottleFeeding';
import { DEFAULT_CHILD_ID } from '@/constants/sleep';
import {
  calculateBottleFeedingStats,
  getLast24HoursBottleFeedingRange,
  getTodayBottleFeedingRange,
} from '@/core/bottleFeeding';
import { ensureDefaultChildProfile } from '@/db/sleepRepository';
import type { BottleFeeding, BottleFeedingStats } from '@/types/bottleFeeding';

interface SaveBottleFeedingInput {
  startedAt: Date;
  volumeMl: number;
}

interface BottleFeedingRow {
  id: string;
  child_id: string;
  started_at: string;
  volume_ml: number;
  created_at: string;
  updated_at: string;
}

function createLocalId(prefix: string, date: Date): string {
  const randomPart = Math.random().toString(36).slice(2, 8);

  return `${prefix}-${date.getTime()}-${randomPart}`;
}

function assertValidBottleFeedingInput(input: SaveBottleFeedingInput): void {
  if (Number.isNaN(input.startedAt.getTime())) {
    throw new Error('Bottle feeding start time must be a valid date');
  }

  if (input.startedAt.getTime() > Date.now()) {
    throw new Error('Bottle feeding start time cannot be in the future');
  }

  if (
    !Number.isInteger(input.volumeMl) ||
    input.volumeMl <= 0 ||
    input.volumeMl > MAX_BOTTLE_FEEDING_VOLUME_ML
  ) {
    throw new Error('Bottle feeding volume must be a positive integer');
  }
}

function mapBottleFeedingRow(row: BottleFeedingRow): BottleFeeding {
  return {
    childId: row.child_id,
    createdAt: row.created_at,
    id: row.id,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    volumeMl: row.volume_ml,
  };
}

async function selectBottleFeedingById(
  db: SQLiteDatabase,
  feedingId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeeding | null> {
  const row = await db.getFirstAsync<BottleFeedingRow>(
    `
    SELECT id, child_id, started_at, volume_ml, created_at, updated_at
    FROM bottle_feedings
    WHERE id = ? AND child_id = ?
    LIMIT 1
    `,
    [feedingId, childId],
  );

  return row ? mapBottleFeedingRow(row) : null;
}

export async function createBottleFeeding(
  db: SQLiteDatabase,
  input: SaveBottleFeedingInput,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeeding> {
  assertValidBottleFeedingInput(input);
  await ensureDefaultChildProfile(db);

  const now = new Date().toISOString();
  const feeding: BottleFeeding = {
    childId,
    createdAt: now,
    id: createLocalId('bottle-feeding', input.startedAt),
    startedAt: input.startedAt.toISOString(),
    updatedAt: now,
    volumeMl: input.volumeMl,
  };

  await db.runAsync(
    `
    INSERT INTO bottle_feedings (
      id,
      child_id,
      started_at,
      volume_ml,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      feeding.id,
      feeding.childId,
      feeding.startedAt,
      feeding.volumeMl,
      feeding.createdAt,
      feeding.updatedAt,
    ],
  );

  return feeding;
}

export async function updateBottleFeeding(
  db: SQLiteDatabase,
  feedingId: string,
  input: SaveBottleFeedingInput,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeeding> {
  assertValidBottleFeedingInput(input);

  const updatedAt = new Date().toISOString();

  await db.runAsync(
    `
    UPDATE bottle_feedings
    SET started_at = ?, volume_ml = ?, updated_at = ?
    WHERE id = ? AND child_id = ?
    `,
    [input.startedAt.toISOString(), input.volumeMl, updatedAt, feedingId, childId],
  );

  const updatedFeeding = await selectBottleFeedingById(db, feedingId, childId);

  if (!updatedFeeding) {
    throw new Error('Bottle feeding was not updated');
  }

  return updatedFeeding;
}

export async function deleteBottleFeeding(
  db: SQLiteDatabase,
  feedingId: string,
  childId = DEFAULT_CHILD_ID,
): Promise<void> {
  await db.runAsync(
    `
    DELETE FROM bottle_feedings
    WHERE id = ? AND child_id = ?
    `,
    [feedingId, childId],
  );
}

export async function listBottleFeedingsInRange(
  db: SQLiteDatabase,
  rangeStart: Date,
  rangeEnd: Date,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeeding[]> {
  const rows = await db.getAllAsync<BottleFeedingRow>(
    `
    SELECT id, child_id, started_at, volume_ml, created_at, updated_at
    FROM bottle_feedings
    WHERE child_id = ?
      AND started_at >= ?
      AND started_at < ?
    ORDER BY started_at ASC, created_at ASC, id ASC
    `,
    [childId, rangeStart.toISOString(), rangeEnd.toISOString()],
  );

  return rows.map(mapBottleFeedingRow);
}

export async function getLatestBottleFeeding(
  db: SQLiteDatabase,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeeding | null> {
  const row = await db.getFirstAsync<BottleFeedingRow>(
    `
    SELECT id, child_id, started_at, volume_ml, created_at, updated_at
    FROM bottle_feedings
    WHERE child_id = ?
    ORDER BY started_at DESC, created_at DESC, id DESC
    LIMIT 1
    `,
    [childId],
  );

  return row ? mapBottleFeedingRow(row) : null;
}

export async function getBottleFeedingStatsInRange(
  db: SQLiteDatabase,
  rangeStart: Date,
  rangeEnd: Date,
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeedingStats> {
  const feedings = await listBottleFeedingsInRange(db, rangeStart, rangeEnd, childId);

  return calculateBottleFeedingStats(feedings);
}

export async function getTodayBottleFeedingStats(
  db: SQLiteDatabase,
  now = new Date(),
  childId = DEFAULT_CHILD_ID,
  timeZone?: string,
): Promise<BottleFeedingStats> {
  const range = getTodayBottleFeedingRange(now, timeZone);

  return getBottleFeedingStatsInRange(db, range.start, range.end, childId);
}

export async function getLast24HoursBottleFeedingStats(
  db: SQLiteDatabase,
  now = new Date(),
  childId = DEFAULT_CHILD_ID,
): Promise<BottleFeedingStats> {
  const range = getLast24HoursBottleFeedingRange(now);

  return getBottleFeedingStatsInRange(db, range.start, range.end, childId);
}
