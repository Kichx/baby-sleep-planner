import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME } from '@/constants/sleep';
import type { SleepKind, SleepSession } from '@/types/sleep';

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

export async function ensureDefaultChildProfile(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `
    INSERT OR IGNORE INTO child_profile (id, name, created_at)
    VALUES (?, ?, ?)
    `,
    [DEFAULT_CHILD_ID, DEFAULT_CHILD_NAME, new Date().toISOString()],
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
