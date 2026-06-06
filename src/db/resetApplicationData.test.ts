import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it } from 'vitest';

import { getOnboardingState } from '@/db/appSettingsRepository';
import { resetApplicationData } from '@/db/resetApplicationData';
import { getSleepDayPlan } from '@/db/sleepRepository';

interface AppSettingsTestRow {
  id: string;
  onboarding_completed_at: string | null;
  onboarding_mode: string | null;
  evening_plan_prompt_dismissed_date_key: string | null;
  tracking_only_bridge_dismissed_date_key: string | null;
}

interface ChildProfileTestRow {
  id: string;
  name: string;
  birth_date: string | null;
  created_at: string;
}

interface TargetDayPlanTestRow {
  id: string;
  child_id: string;
  is_active: number;
}

interface SleepSessionTestRow {
  id: string;
  child_id: string;
  ended_at: string | null;
}

class FakeResetDatabase {
  appSettings: AppSettingsTestRow[] = [];
  bottleFeedings: Array<{ id: string; child_id: string }> = [];
  childProfiles: ChildProfileTestRow[] = [];
  execSqls: string[] = [];
  runSqls: string[] = [];
  sleepDayPlanSnapshots: Array<{ child_id: string; sleep_day_date: string }> = [];
  sleepDayTemporaryModes: Array<{ id: string; child_id: string }> = [];
  sleepSessions: SleepSessionTestRow[] = [];
  targetDayPlans: TargetDayPlanTestRow[] = [];
  usedExclusiveTransaction = false;

  async execAsync(sql: string): Promise<void> {
    this.execSqls.push(sql);
  }

  async withExclusiveTransactionAsync(
    callback: (txn: SQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.usedExclusiveTransaction = true;
    await callback(this as unknown as SQLiteDatabase);
  }

  async withTransactionAsync(callback: () => Promise<void>): Promise<void> {
    await callback();
  }

  async runAsync(_sql: string, params: unknown[] = []): Promise<void> {
    const sql = _sql.replace(/\s+/g, ' ');
    this.runSqls.push(sql);

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

    if (sql.includes('DELETE FROM app_settings')) {
      this.appSettings = [];
      return;
    }

    if (sql.includes('DELETE FROM child_profile')) {
      this.childProfiles = [];
      return;
    }

    if (sql.includes('INSERT OR IGNORE INTO child_profile')) {
      const id = String(params[0]);

      if (!this.childProfiles.some((profile) => profile.id === id)) {
        this.childProfiles.push({
          birth_date: params[2] === null ? null : String(params[2]),
          created_at: String(params[4]),
          id,
          name: String(params[1]),
        });
      }
    }
  }

  async getFirstAsync<T>(_sql: string, params: unknown[] = []): Promise<T | null> {
    const sql = _sql.replace(/\s+/g, ' ');

    if (sql.includes('FROM app_settings')) {
      return (this.appSettings[0] ?? null) as T | null;
    }

    if (sql.includes('FROM target_day_plan') && sql.includes('is_active = 1')) {
      const childId = String(params[0]);
      const activePlan =
        this.targetDayPlans.find(
          (plan) => plan.child_id === childId && plan.is_active === 1,
        ) ?? null;

      return activePlan ? ({ id: activePlan.id } as T) : null;
    }

    if (sql.includes('FROM target_day_plan')) {
      const childId = String(params[0]);
      const plan = this.targetDayPlans.find((item) => item.child_id === childId) ?? null;

      return plan ? ({ id: plan.id } as T) : null;
    }

    return null;
  }

  async getAllAsync<T>(_sql: string, params: unknown[] = []): Promise<T[]> {
    const sql = _sql.replace(/\s+/g, ' ');

    if (sql.includes('PRAGMA table_info(app_settings)')) {
      return [
        { name: 'id' },
        { name: 'onboarding_completed_at' },
        { name: 'onboarding_mode' },
        { name: 'evening_plan_prompt_dismissed_date_key' },
        { name: 'tracking_only_bridge_dismissed_date_key' },
      ] as T[];
    }

    if (sql.includes('PRAGMA table_info(child_profile)')) {
      return [
        { name: 'id' },
        { name: 'name' },
        { name: 'birth_date' },
        { name: 'photo_uri' },
        { name: 'bottle_feeding_enabled' },
        { name: 'bottle_feeding_prompt_dismissed' },
        { name: 'bottle_feeding_default_volume_ml' },
        { name: 'bottle_feeding_top_up_threshold_ml' },
        { name: 'bottle_feeding_reminders_enabled' },
        { name: 'bottle_feeding_reminder_interval_minutes' },
        { name: 'bottle_feeding_notify_during_sleep' },
        { name: 'created_at' },
      ] as T[];
    }

    if (sql.includes('PRAGMA table_info(target_day_plan)')) {
      return [
        { name: 'id' },
        { name: 'child_id' },
        { name: 'name' },
        { name: 'is_active' },
        { name: 'evening_rules_mode' },
        { name: 'wake_up_start_minutes' },
        { name: 'wake_up_end_minutes' },
        { name: 'target_awake_min_minutes' },
        { name: 'target_awake_max_minutes' },
        { name: 'target_awake_minutes' },
        { name: 'nap_count' },
        { name: 'target_day_sleep_min_minutes' },
        { name: 'target_day_sleep_max_minutes' },
        { name: 'target_day_sleep_minutes' },
        { name: 'bedtime_target_minutes' },
        { name: 'latest_evening_nap_end_minutes' },
        { name: 'max_evening_nap_minutes' },
        { name: 'micro_nap_minutes' },
        { name: 'updated_at' },
      ] as T[];
    }

    if (sql.includes('FROM target_day_plan')) {
      const childId = String(params[0]);

      return this.targetDayPlans.filter((plan) => plan.child_id === childId) as T[];
    }

    return [];
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeResetDatabase {
  return new FakeResetDatabase() as SQLiteDatabase & FakeResetDatabase;
}

function seedUserData(db: FakeResetDatabase): void {
  db.childProfiles = [
    {
      birth_date: '2026-01-10',
      created_at: '2026-06-01T06:00:00.000Z',
      id: 'default-child',
      name: 'Малыш',
    },
  ];
  db.targetDayPlans = [
    {
      child_id: 'default-child',
      id: 'active-plan',
      is_active: 1,
    },
  ];
  db.sleepSessions = [
    {
      child_id: 'default-child',
      ended_at: '2026-06-05T07:20:00.000Z',
      id: 'finished-sleep',
    },
    {
      child_id: 'default-child',
      ended_at: null,
      id: 'active-sleep',
    },
  ];
  db.sleepDayPlanSnapshots = [
    {
      child_id: 'default-child',
      sleep_day_date: '2026-06-05',
    },
  ];
  db.sleepDayTemporaryModes = [
    {
      child_id: 'default-child',
      id: 'temporary-mode',
    },
  ];
  db.bottleFeedings = [
    {
      child_id: 'default-child',
      id: 'feeding',
    },
  ];
  db.appSettings = [
    {
      evening_plan_prompt_dismissed_date_key: '2026-06-05',
      id: 'default',
      onboarding_completed_at: '2026-06-05T06:00:00.000Z',
      onboarding_mode: 'tracking_only',
      tracking_only_bridge_dismissed_date_key: '2026-06-05',
    },
  ];
}

describe('resetApplicationData', () => {
  it('clears local user data and returns onboarding to not started', async () => {
    const db = createFakeDatabase();
    seedUserData(db);

    await resetApplicationData(db);

    expect(db.sleepDayTemporaryModes).toEqual([]);
    expect(db.sleepDayPlanSnapshots).toEqual([]);
    expect(db.targetDayPlans).toEqual([]);
    expect(db.bottleFeedings).toEqual([]);
    expect(db.sleepSessions).toEqual([]);
    expect(db.appSettings).toEqual([]);
    expect(db.childProfiles).toEqual([]);
    await expect(getOnboardingState(db)).resolves.toBe('not_started');
    expect(db.usedExclusiveTransaction).toBe(true);
  });

  it('does not create target day plans during the next sleep-day plan bootstrap', async () => {
    const db = createFakeDatabase();
    seedUserData(db);

    await resetApplicationData(db);
    await getSleepDayPlan(
      db,
      new Date('2026-06-05T08:00:00.000Z'),
      new Date('2026-06-05T08:00:00.000Z'),
    );

    expect(db.targetDayPlans).toEqual([]);
    expect(db.runSqls.join('\n')).not.toContain('INSERT INTO target_day_plan');
  });

  it('is idempotent', async () => {
    const db = createFakeDatabase();
    seedUserData(db);

    await resetApplicationData(db);
    await resetApplicationData(db);

    await expect(getOnboardingState(db)).resolves.toBe('not_started');
    expect(db.targetDayPlans).toEqual([]);
    expect(db.childProfiles).toEqual([]);
  });

  it('keeps a fresh schema-valid database empty', async () => {
    const db = createFakeDatabase();

    await resetApplicationData(db);

    expect(db.execSqls.join('\n')).toContain('CREATE TABLE IF NOT EXISTS child_profile');
    await expect(getOnboardingState(db)).resolves.toBe('not_started');
    expect(db.targetDayPlans).toEqual([]);
  });
});
