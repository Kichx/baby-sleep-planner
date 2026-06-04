import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/sleepRepository', () => ({
  backfillMissingSleepDayPlanSnapshots: vi.fn(),
  ensureDefaultChildProfile: vi.fn(),
  ensureSleepDayPlanSnapshotStorage: vi.fn(),
  getTargetDayPlan: vi.fn(),
}));

import {
  APP_DATA_BACKUP_FORMAT,
  APP_DATA_BACKUP_FORMAT_VERSION,
  type AppDataBackup,
  buildAppDataBackup,
  restoreAppDataBackup,
} from '@/db/dataTransfer';

type BackupData = AppDataBackup['data'];
type ChildProfileBackupRow = BackupData['childProfiles'][number];
type SleepSessionBackupRow = BackupData['sleepSessions'][number];
type BottleFeedingBackupRow = BackupData['bottleFeedings'][number];
type SleepDayPlanSnapshotBackupRow = BackupData['sleepDayPlanSnapshots'][number];
type SleepDayTemporaryModeBackupRow = BackupData['sleepDayTemporaryModes'][number];
type TargetDayPlanBackupRow = BackupData['targetDayPlans'][number];

const childProfile: ChildProfileBackupRow = {
  birth_date: null,
  bottle_feeding_default_volume_ml: 180,
  bottle_feeding_enabled: 0,
  bottle_feeding_notify_during_sleep: 1,
  bottle_feeding_prompt_dismissed: 0,
  bottle_feeding_reminder_interval_minutes: 180,
  bottle_feeding_reminders_enabled: 0,
  bottle_feeding_top_up_threshold_ml: 30,
  created_at: '2026-06-01T06:00:00.000Z',
  id: 'default-child',
  name: 'Baby',
};

const targetDayPlan: TargetDayPlanBackupRow = {
  bedtime_target_minutes: 1170,
  child_id: 'default-child',
  evening_rules_mode: 'auto',
  id: 'base-plan-1',
  is_active: 1,
  latest_evening_nap_end_minutes: 1200,
  max_evening_nap_minutes: 45,
  micro_nap_minutes: 20,
  name: 'Main',
  nap_count: 3,
  target_awake_max_minutes: 540,
  target_awake_min_minutes: 480,
  target_awake_minutes: 510,
  target_day_sleep_max_minutes: 270,
  target_day_sleep_min_minutes: 210,
  target_day_sleep_minutes: 240,
  updated_at: '2026-06-01T06:00:00.000Z',
  wake_up_end_minutes: 450,
  wake_up_start_minutes: 420,
};

const temporaryMode: SleepDayTemporaryModeBackupRow = {
  base_plan_id: 'base-plan-1',
  child_id: 'default-child',
  created_at: '2026-06-03T04:30:00.000Z',
  disabled_at: null,
  dismissed_at: '2026-06-03T04:35:00.000Z',
  id: 'temporary-mode-1',
  mode: 'early_wake',
  sleep_day_date_key: '2026-06-03',
};

class FakeDataTransferDatabase {
  bottleFeedings: BottleFeedingBackupRow[] = [];
  childProfiles: ChildProfileBackupRow[] = [childProfile];
  sleepDayPlanSnapshots: SleepDayPlanSnapshotBackupRow[] = [];
  sleepDayTemporaryModes: SleepDayTemporaryModeBackupRow[] = [];
  sleepSessions: SleepSessionBackupRow[] = [];
  targetDayPlans: TargetDayPlanBackupRow[] = [targetDayPlan];

  async execAsync(): Promise<void> {}

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  async getAllAsync<T>(_sql: string, params: unknown[] = []): Promise<T[]> {
    const sql = _sql.replace(/\s+/g, ' ');

    if (sql.includes('SELECT id FROM child_profile')) {
      return this.childProfiles.map((profile) => ({ id: profile.id })) as T[];
    }

    if (sql.includes('FROM child_profile')) {
      return this.childProfiles as T[];
    }

    if (sql.includes('FROM bottle_feedings')) {
      return this.bottleFeedings as T[];
    }

    if (sql.includes('FROM sleep_sessions')) {
      return this.sleepSessions as T[];
    }

    if (sql.includes('FROM sleep_day_temporary_mode')) {
      return this.sleepDayTemporaryModes as T[];
    }

    if (sql.includes('FROM sleep_day_plan_snapshot')) {
      return this.sleepDayPlanSnapshots as T[];
    }

    if (sql.includes('FROM target_day_plan') && sql.includes('WHERE child_id = ? AND is_active = 1')) {
      const [childId] = params;

      return this.targetDayPlans
        .filter((plan) => plan.child_id === childId && plan.is_active === 1)
        .map((plan) => ({ id: plan.id })) as T[];
    }

    if (sql.includes('FROM target_day_plan')) {
      return this.targetDayPlans as T[];
    }

    return [];
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes('SELECT COUNT(*) AS count FROM sleep_day_plan_snapshot')) {
      return { count: this.sleepDayPlanSnapshots.length } as T;
    }

    if (sql.includes('FROM target_day_plan')) {
      const [childId] = params;
      const plan =
        this.targetDayPlans.find((item) => item.child_id === childId && item.is_active === 1) ??
        this.targetDayPlans.find((item) => item.child_id === childId);

      return plan ? ({ id: plan.id } as T) : null;
    }

    return null;
  }

  async runAsync(_sql: string, params: unknown[] = []): Promise<void> {
    const sql = _sql.replace(/\s+/g, ' ');

    if (sql.includes('DELETE FROM sleep_day_temporary_mode')) {
      this.sleepDayTemporaryModes = [];

      return;
    }

    if (sql.includes('DELETE FROM sleep_day_plan_snapshot')) {
      this.sleepDayPlanSnapshots = [];

      return;
    }

    if (sql.includes('DELETE FROM target_day_plan')) {
      this.targetDayPlans = [];

      return;
    }

    if (sql.includes('DELETE FROM bottle_feedings')) {
      this.bottleFeedings = [];

      return;
    }

    if (sql.includes('DELETE FROM sleep_sessions')) {
      this.sleepSessions = [];

      return;
    }

    if (sql.includes('DELETE FROM child_profile')) {
      this.childProfiles = [];

      return;
    }

    if (sql.includes('INSERT INTO child_profile')) {
      this.childProfiles.push({
        birth_date: params[2] as string | null,
        bottle_feeding_default_volume_ml: Number(params[5]),
        bottle_feeding_enabled: Number(params[3]),
        bottle_feeding_notify_during_sleep: Number(params[9]),
        bottle_feeding_prompt_dismissed: Number(params[4]),
        bottle_feeding_reminder_interval_minutes: Number(params[8]),
        bottle_feeding_reminders_enabled: Number(params[7]),
        bottle_feeding_top_up_threshold_ml: Number(params[6]),
        created_at: String(params[10]),
        id: String(params[0]),
        name: String(params[1]),
      });

      return;
    }

    if (sql.includes('INSERT INTO target_day_plan')) {
      this.targetDayPlans.push({
        bedtime_target_minutes: Number(params[14]),
        child_id: String(params[1]),
        evening_rules_mode: params[4] === 'custom' ? 'custom' : 'auto',
        id: String(params[0]),
        is_active: Number(params[3]),
        latest_evening_nap_end_minutes: Number(params[15]),
        max_evening_nap_minutes: Number(params[16]),
        micro_nap_minutes: Number(params[17]),
        name: String(params[2]),
        nap_count: params[10] === null ? null : Number(params[10]),
        target_awake_max_minutes: params[8] === null ? null : Number(params[8]),
        target_awake_min_minutes: params[7] === null ? null : Number(params[7]),
        target_awake_minutes: Number(params[9]),
        target_day_sleep_max_minutes: params[12] === null ? null : Number(params[12]),
        target_day_sleep_min_minutes: params[11] === null ? null : Number(params[11]),
        target_day_sleep_minutes: Number(params[13]),
        updated_at: String(params[18]),
        wake_up_end_minutes: params[6] === null ? null : Number(params[6]),
        wake_up_start_minutes: params[5] === null ? null : Number(params[5]),
      });

      return;
    }

    if (sql.includes('INSERT INTO sleep_day_temporary_mode')) {
      this.sleepDayTemporaryModes.push({
        base_plan_id: String(params[4]),
        child_id: String(params[1]),
        created_at: String(params[5]),
        disabled_at: params[6] === null ? null : String(params[6]),
        dismissed_at: params[7] === null ? null : String(params[7]),
        id: String(params[0]),
        mode: params[3] === 'soft_day' ? 'soft_day' : 'early_wake',
        sleep_day_date_key: String(params[2]),
      });
    }
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeDataTransferDatabase {
  return new FakeDataTransferDatabase() as SQLiteDatabase & FakeDataTransferDatabase;
}

describe('data transfer temporary modes', () => {
  it('exports and imports sleep day temporary modes', async () => {
    const sourceDb = createFakeDatabase();
    sourceDb.sleepDayTemporaryModes = [temporaryMode];

    const backup = await buildAppDataBackup(sourceDb);

    expect(backup.formatVersion).toBe(APP_DATA_BACKUP_FORMAT_VERSION);
    expect(backup.data.sleepDayTemporaryModes).toEqual([temporaryMode]);

    const targetDb = createFakeDatabase();
    targetDb.sleepDayTemporaryModes = [
      {
        ...temporaryMode,
        id: 'old-temporary-mode',
      },
    ];

    const summary = await restoreAppDataBackup(targetDb, backup);

    expect(targetDb.sleepDayTemporaryModes).toEqual([temporaryMode]);
    expect(summary.sleepDayTemporaryModes).toBe(1);
  });

  it('imports old backups without temporary modes safely', async () => {
    const sourceDb = createFakeDatabase();
    const backup = await buildAppDataBackup(sourceDb);
    const { sleepDayTemporaryModes, ...oldData } = backup.data;
    const oldBackup = {
      data: oldData,
      databaseVersion: backup.databaseVersion,
      exportedAt: backup.exportedAt,
      format: APP_DATA_BACKUP_FORMAT,
      formatVersion: 9,
    } as unknown as AppDataBackup;
    const targetDb = createFakeDatabase();
    targetDb.sleepDayTemporaryModes = [temporaryMode];

    const summary = await restoreAppDataBackup(targetDb, oldBackup);

    expect(sleepDayTemporaryModes).toEqual([]);
    expect(targetDb.sleepDayTemporaryModes).toEqual([]);
    expect(summary.sleepDayTemporaryModes).toBe(0);
  });
});
