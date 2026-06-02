import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

import {
  createBottleFeeding,
  deleteBottleFeeding,
  getLast24HoursBottleFeedingStats,
  getLatestBottleFeeding,
  getTodayBottleFeedingStats,
  listBottleFeedingsInRange,
  updateBottleFeeding,
} from '@/db/bottleFeedingRepository';

vi.mock('@/db/sleepRepository', () => ({
  ensureDefaultChildProfile: vi.fn(),
}));

interface BottleFeedingTestRow {
  id: string;
  child_id: string;
  started_at: string;
  volume_ml: number;
  created_at: string;
  updated_at: string;
}

class FakeBottleFeedingDatabase {
  rows: BottleFeedingTestRow[] = [];

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes('INSERT INTO bottle_feedings')) {
      this.rows.push({
        child_id: String(params[1]),
        created_at: String(params[4]),
        id: String(params[0]),
        started_at: String(params[2]),
        updated_at: String(params[5]),
        volume_ml: Number(params[3]),
      });

      return;
    }

    if (sql.includes('UPDATE bottle_feedings')) {
      const [startedAt, volumeMl, updatedAt, feedingId, childId] = params;
      const row = this.rows.find(
        (item) => item.id === feedingId && item.child_id === childId,
      );

      if (row) {
        row.started_at = String(startedAt);
        row.volume_ml = Number(volumeMl);
        row.updated_at = String(updatedAt);
      }

      return;
    }

    if (sql.includes('DELETE FROM bottle_feedings')) {
      const [feedingId, childId] = params;

      this.rows = this.rows.filter(
        (item) => item.id !== feedingId || item.child_id !== childId,
      );
    }
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes('WHERE id = ? AND child_id = ?')) {
      const [feedingId, childId] = params;
      const row = this.rows.find(
        (item) => item.id === feedingId && item.child_id === childId,
      );

      return (row ?? null) as T | null;
    }

    const [childId] = params;
    const row = this.rows
      .filter((item) => item.child_id === childId)
      .sort((first, second) => second.started_at.localeCompare(first.started_at))[0];

    return (row ?? null) as T | null;
  }

  async getAllAsync<T>(_sql: string, params: unknown[] = []): Promise<T[]> {
    const [childId, rangeStart, rangeEnd] = params;

    return this.rows
      .filter(
        (item) =>
          item.child_id === childId &&
          item.started_at >= String(rangeStart) &&
          item.started_at < String(rangeEnd),
      )
      .sort((first, second) => first.started_at.localeCompare(second.started_at)) as T[];
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeBottleFeedingDatabase {
  return new FakeBottleFeedingDatabase() as SQLiteDatabase & FakeBottleFeedingDatabase;
}

describe('bottle feeding repository', () => {
  it('creates, reads latest, updates, and deletes bottle feedings', async () => {
    const db = createFakeDatabase();
    const first = await createBottleFeeding(db, {
      startedAt: new Date('2026-05-31T06:00:00.000Z'),
      volumeMl: 90,
    });
    const second = await createBottleFeeding(db, {
      startedAt: new Date('2026-05-31T09:00:00.000Z'),
      volumeMl: 120,
    });

    expect(await getLatestBottleFeeding(db)).toMatchObject({
      id: second.id,
      volumeMl: 120,
    });

    const updated = await updateBottleFeeding(db, first.id, {
      startedAt: new Date('2026-05-31T07:00:00.000Z'),
      volumeMl: 100,
    });

    expect(updated).toMatchObject({
      id: first.id,
      startedAt: '2026-05-31T07:00:00.000Z',
      volumeMl: 100,
    });

    await deleteBottleFeeding(db, second.id);

    expect(
      await listBottleFeedingsInRange(
        db,
        new Date('2026-05-31T00:00:00.000Z'),
        new Date('2026-06-01T00:00:00.000Z'),
      ),
    ).toHaveLength(1);
  });

  it('calculates today and last 24 hours stats through repository ranges', async () => {
    const db = createFakeDatabase();

    await createBottleFeeding(db, {
      startedAt: new Date('2026-05-30T20:59:00.000Z'),
      volumeMl: 60,
    });
    await createBottleFeeding(db, {
      startedAt: new Date('2026-05-30T21:30:00.000Z'),
      volumeMl: 90,
    });
    await createBottleFeeding(db, {
      startedAt: new Date('2026-05-31T20:59:00.000Z'),
      volumeMl: 120,
    });
    await createBottleFeeding(db, {
      startedAt: new Date('2026-05-31T21:00:00.000Z'),
      volumeMl: 150,
    });

    await expect(
      getTodayBottleFeedingStats(
        db,
        new Date('2026-05-31T12:00:00.000Z'),
        'default-child',
        'Europe/Moscow',
      ),
    ).resolves.toEqual({
      count: 2,
      totalVolumeMl: 210,
    });

    await expect(
      getLast24HoursBottleFeedingStats(
        db,
        new Date('2026-05-31T21:00:00.000Z'),
      ),
    ).resolves.toEqual({
      count: 2,
      totalVolumeMl: 210,
    });
  });
});
