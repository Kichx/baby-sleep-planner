import type { SQLiteDatabase } from 'expo-sqlite';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SLEEP_PLAN } from '@/constants/sleep';
import { getOnboardingState } from '@/db/appSettingsRepository';
import {
  activateTargetDayPlan,
  createTargetDayPlan,
  getTargetDayPlan,
  listTargetDayPlans,
} from '@/db/sleepRepository';

interface TargetDayPlanTestRow {
  id: string;
  child_id: string;
  name: string;
  is_active: number;
  evening_rules_mode: string;
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
  latest_evening_nap_end_minutes: number;
  max_evening_nap_minutes: number;
  micro_nap_minutes: number;
  updated_at: string;
}

interface AppSettingsTestRow {
  id: string;
  onboarding_completed_at: string | null;
  onboarding_mode: string | null;
  evening_plan_prompt_dismissed_date_key: string | null;
  tracking_only_bridge_dismissed_date_key: string | null;
}

class FakeSleepRepositoryDatabase {
  appSettingsRow: AppSettingsTestRow | null = null;
  execSqls: string[] = [];
  runSqls: string[] = [];
  targetPlanRows: TargetDayPlanTestRow[] = [];

  async execAsync(sql: string): Promise<void> {
    this.execSqls.push(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    this.runSqls.push(sql);

    if (sql.includes('INSERT INTO app_settings')) {
      this.appSettingsRow = {
        evening_plan_prompt_dismissed_date_key: null,
        id: String(params[0]),
        onboarding_completed_at: String(params[1]),
        onboarding_mode: 'plan_saved',
        tracking_only_bridge_dismissed_date_key: null,
      };

      return;
    }

    if (sql.includes('INSERT INTO target_day_plan')) {
      this.targetPlanRows.push({
        bedtime_target_minutes: Number(params[14]),
        child_id: String(params[1]),
        evening_rules_mode: String(params[4]),
        id: String(params[0]),
        is_active: Number(params[3]),
        latest_evening_nap_end_minutes: Number(params[15]),
        max_evening_nap_minutes: Number(params[16]),
        micro_nap_minutes: Number(params[17]),
        name: String(params[2]),
        nap_count: Number(params[10]),
        target_awake_max_minutes: Number(params[8]),
        target_awake_min_minutes: Number(params[7]),
        target_awake_minutes: Number(params[9]),
        target_day_sleep_max_minutes: Number(params[12]),
        target_day_sleep_min_minutes: Number(params[11]),
        target_day_sleep_minutes: Number(params[13]),
        updated_at: String(params[18]),
        wake_up_end_minutes: Number(params[6]),
        wake_up_start_minutes: Number(params[5]),
      });

      return;
    }

    if (sql.includes('is_active = CASE WHEN id = ? THEN 1 ELSE 0')) {
      const planId = String(params[0]);
      const childId = String(params[params.length - 1]);
      const updatedAt = params.length > 2 ? String(params[2]) : null;

      this.targetPlanRows = this.targetPlanRows.map((plan) =>
        plan.child_id === childId
          ? {
              ...plan,
              is_active: plan.id === planId ? 1 : 0,
              updated_at: plan.id === planId && updatedAt ? updatedAt : plan.updated_at,
            }
          : plan,
      );
    }
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (sql.includes('FROM app_settings')) {
      return this.appSettingsRow as T | null;
    }

    if (sql.includes('FROM target_day_plan') && sql.includes('WHERE id = ? AND child_id = ?')) {
      const [planId, childId] = params;
      const row =
        this.targetPlanRows.find(
          (plan) => plan.id === String(planId) && plan.child_id === String(childId),
        ) ?? null;

      return row as T | null;
    }

    if (sql.includes('FROM target_day_plan') && sql.includes('is_active = 1')) {
      const childId = String(params[0]);
      const row =
        this.targetPlanRows.find(
          (plan) => plan.child_id === childId && plan.is_active === 1,
        ) ?? null;

      return row ? ({ id: row.id } as T) : null;
    }

    return null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM target_day_plan') && sql.includes('is_active = 1')) {
      const childId = String(params[0]);

      return this.targetPlanRows
        .filter((plan) => plan.child_id === childId && plan.is_active === 1)
        .map((plan) => ({ id: plan.id })) as T[];
    }

    if (sql.includes('FROM target_day_plan')) {
      const childId = String(params[0]);

      return this.targetPlanRows.filter((plan) => plan.child_id === childId) as T[];
    }

    return [];
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeSleepRepositoryDatabase {
  return new FakeSleepRepositoryDatabase() as SQLiteDatabase & FakeSleepRepositoryDatabase;
}

describe('sleep repository target plan fallback', () => {
  it('does not persist DEFAULT_SLEEP_PLAN when reading target plan fallback', async () => {
    const db = createFakeDatabase();

    await expect(getTargetDayPlan(db)).resolves.toEqual(DEFAULT_SLEEP_PLAN);
    await expect(listTargetDayPlans(db)).resolves.toEqual([]);

    expect(db.runSqls.join('\n')).not.toContain('INSERT INTO target_day_plan');
  });

  it('creates target_day_plan only after an explicit target day plan save', async () => {
    const db = createFakeDatabase();

    await expect(listTargetDayPlans(db)).resolves.toEqual([]);
    expect(db.targetPlanRows).toHaveLength(0);

    const createdPlan = await createTargetDayPlan(db, {
      eveningRulesMode: 'auto',
      name: '4 сна · 5-6 мес',
      plan: DEFAULT_SLEEP_PLAN,
    });

    expect(createdPlan.name).toBe('4 сна · 5-6 мес');
    expect(db.targetPlanRows).toHaveLength(1);
    await expect(getOnboardingState(db)).resolves.toBe('plan_saved');
  });

  it('keeps exactly one active target day plan after activating a saved plan', async () => {
    const db = createFakeDatabase();

    const firstPlan = await createTargetDayPlan(db, {
      eveningRulesMode: 'auto',
      name: 'Plan A',
      plan: DEFAULT_SLEEP_PLAN,
    });
    const secondPlan = await createTargetDayPlan(db, {
      eveningRulesMode: 'auto',
      name: 'Plan B',
      plan: DEFAULT_SLEEP_PLAN,
    });

    await activateTargetDayPlan(db, firstPlan.id);
    await activateTargetDayPlan(db, secondPlan.id);

    const plans = await listTargetDayPlans(db);
    const activePlans = plans.filter((plan) => plan.isActive);

    expect(plans).toHaveLength(2);
    expect(activePlans.map((plan) => plan.id)).toEqual([secondPlan.id]);
    await expect(getOnboardingState(db)).resolves.toBe('plan_saved');
  });
});
