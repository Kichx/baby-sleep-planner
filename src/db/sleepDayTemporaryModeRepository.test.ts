import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  disableAllSleepDayTemporaryModes,
  disableSleepDayTemporaryMode,
  dismissSleepDayTemporaryModeSuggestion,
  enableSleepDayTemporaryMode,
  listSleepDayTemporaryModes,
} from '@/db/sleepDayTemporaryModeRepository';
import type { SleepDayTemporaryModeType } from '@/types/sleep';

vi.mock('@/db/sleepRepository', () => ({
  ensureDefaultChildProfile: vi.fn(),
}));

interface SleepDayTemporaryModeTestRow {
  id: string;
  child_id: string;
  sleep_day_date_key: string;
  mode: SleepDayTemporaryModeType;
  base_plan_id: string;
  created_at: string;
  disabled_at: string | null;
  dismissed_at: string | null;
}

class FakeSleepDayTemporaryModeDatabase {
  rows: SleepDayTemporaryModeTestRow[] = [];
  targetPlanSelectCount = 0;

  async execAsync(): Promise<void> {}

  async runAsync(_sql: string, params: unknown[] = []): Promise<void> {
    const sql = _sql.replace(/\s+/g, ' ');

    if (sql.includes('INSERT INTO sleep_day_temporary_mode')) {
      const row: SleepDayTemporaryModeTestRow = {
        base_plan_id: String(params[4]),
        child_id: String(params[1]),
        created_at: String(params[5]),
        disabled_at: params[6] === null ? null : String(params[6]),
        dismissed_at: params[7] === null ? null : String(params[7]),
        id: String(params[0]),
        mode: params[3] as SleepDayTemporaryModeType,
        sleep_day_date_key: String(params[2]),
      };
      const duplicate = this.rows.some(
        (item) =>
          item.child_id === row.child_id &&
          item.sleep_day_date_key === row.sleep_day_date_key &&
          item.mode === row.mode,
      );

      if (duplicate) {
        throw new Error('Duplicate temporary mode');
      }

      this.rows.push(row);

      return;
    }

    if (sql.includes('SET base_plan_id = ?')) {
      const [basePlanId, childId, sleepDayDateKey, mode] = params;
      const row = this.findRow(String(childId), String(sleepDayDateKey), mode);

      if (row) {
        row.base_plan_id = String(basePlanId);
        row.disabled_at = null;
        row.dismissed_at = null;
      }

      return;
    }

    if (sql.includes('SET disabled_at = ?') && sql.includes('AND mode = ?')) {
      const [disabledAt, childId, sleepDayDateKey, mode] = params;
      const row = this.findRow(String(childId), String(sleepDayDateKey), mode);

      if (row) {
        row.disabled_at = String(disabledAt);
      }

      return;
    }

    if (sql.includes('SET disabled_at = ?')) {
      const [disabledAt, childId, sleepDayDateKey] = params;

      for (const row of this.rows) {
        if (row.child_id === childId && row.sleep_day_date_key === sleepDayDateKey) {
          row.disabled_at = String(disabledAt);
        }
      }

      return;
    }

    if (sql.includes('SET dismissed_at = ?')) {
      const [dismissedAt, childId, sleepDayDateKey, mode] = params;
      const row = this.findRow(String(childId), String(sleepDayDateKey), mode);

      if (row) {
        row.dismissed_at = String(dismissedAt);
      }
    }
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes('FROM target_day_plan')) {
      this.targetPlanSelectCount += 1;

      return { id: 'active-plan' } as T;
    }

    const [childId, sleepDayDateKey, mode] = params;
    const row = this.findRow(String(childId), String(sleepDayDateKey), mode);

    return (row ?? null) as T | null;
  }

  async getAllAsync<T>(_sql: string, params: unknown[] = []): Promise<T[]> {
    const [childId, sleepDayDateKey] = params;

    return this.rows
      .filter((row) => row.child_id === childId && row.sleep_day_date_key === sleepDayDateKey)
      .sort((first, second) => {
        const createdAtOrder = first.created_at.localeCompare(second.created_at);

        return createdAtOrder === 0 ? first.mode.localeCompare(second.mode) : createdAtOrder;
      }) as T[];
  }

  private findRow(
    childId: string,
    sleepDayDateKey: string,
    mode: unknown,
  ): SleepDayTemporaryModeTestRow | undefined {
    return this.rows.find(
      (item) =>
        item.child_id === childId &&
        item.sleep_day_date_key === sleepDayDateKey &&
        item.mode === mode,
    );
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeSleepDayTemporaryModeDatabase {
  return new FakeSleepDayTemporaryModeDatabase() as SQLiteDatabase &
    FakeSleepDayTemporaryModeDatabase;
}

describe('sleep day temporary mode repository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-03T06:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enables, lists, and disables a temporary mode', async () => {
    const db = createFakeDatabase();

    const enabled = await enableSleepDayTemporaryMode(
      db,
      'default-child',
      '2026-06-03',
      'soft_day',
      'base-plan-1',
    );

    expect(enabled).toMatchObject({
      basePlanId: 'base-plan-1',
      disabledAt: null,
      mode: 'soft_day',
      sleepDayDateKey: '2026-06-03',
    });
    expect(db.targetPlanSelectCount).toBe(0);

    await expect(
      listSleepDayTemporaryModes(db, 'default-child', '2026-06-03'),
    ).resolves.toMatchObject([{ mode: 'soft_day', disabledAt: null }]);

    await disableSleepDayTemporaryMode(db, 'default-child', '2026-06-03', 'soft_day');

    await expect(
      listSleepDayTemporaryModes(db, 'default-child', '2026-06-03'),
    ).resolves.toMatchObject([
      {
        disabledAt: '2026-06-03T06:00:00.000Z',
        mode: 'soft_day',
      },
    ]);
  });

  it('disables all temporary modes for a sleep day', async () => {
    const db = createFakeDatabase();

    await enableSleepDayTemporaryMode(
      db,
      'default-child',
      '2026-06-03',
      'soft_day',
      'base-plan-1',
    );
    await enableSleepDayTemporaryMode(
      db,
      'default-child',
      '2026-06-03',
      'early_wake',
      'base-plan-1',
    );

    await disableAllSleepDayTemporaryModes(db, 'default-child', '2026-06-03');

    const modes = await listSleepDayTemporaryModes(db, 'default-child', '2026-06-03');

    expect(modes).toHaveLength(2);
    expect(modes.every((mode) => mode.disabledAt === '2026-06-03T06:00:00.000Z')).toBe(
      true,
    );
  });

  it('does not create a duplicate when enabling the same mode again', async () => {
    const db = createFakeDatabase();

    await enableSleepDayTemporaryMode(
      db,
      'default-child',
      '2026-06-03',
      'soft_day',
      'base-plan-1',
    );
    await disableSleepDayTemporaryMode(db, 'default-child', '2026-06-03', 'soft_day');

    const enabledAgain = await enableSleepDayTemporaryMode(
      db,
      'default-child',
      '2026-06-03',
      'soft_day',
      'base-plan-2',
    );

    expect(db.rows).toHaveLength(1);
    expect(enabledAgain).toMatchObject({
      basePlanId: 'base-plan-2',
      disabledAt: null,
      dismissedAt: null,
      mode: 'soft_day',
    });
  });

  it('saves and reads a dismissed temporary mode suggestion', async () => {
    const db = createFakeDatabase();

    await dismissSleepDayTemporaryModeSuggestion(
      db,
      'default-child',
      '2026-06-03',
      'early_wake',
    );

    await expect(
      listSleepDayTemporaryModes(db, 'default-child', '2026-06-03'),
    ).resolves.toMatchObject([
      {
        basePlanId: 'active-plan',
        disabledAt: '2026-06-03T06:00:00.000Z',
        dismissedAt: '2026-06-03T06:00:00.000Z',
        mode: 'early_wake',
      },
    ]);
  });
});
