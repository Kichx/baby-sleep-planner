import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completeOnboardingTrackingOnly,
  getOnboardingState,
  markOnboardingPlanSaved,
} from '@/db/appSettingsRepository';

interface AppSettingsTestRow {
  id: string;
  onboarding_completed_at: string | null;
  onboarding_mode: string | null;
  evening_plan_prompt_dismissed_date_key: string | null;
}

class FakeAppSettingsDatabase {
  appSettingsRow: AppSettingsTestRow | null = null;
  hasActivePlan = false;
  runSqls: string[] = [];

  async execAsync(): Promise<void> {}

  async runAsync(_sql: string, params: unknown[] = []): Promise<void> {
    const sql = _sql.replace(/\s+/g, ' ');
    this.runSqls.push(sql);

    if (!sql.includes('INSERT INTO app_settings')) {
      return;
    }

    const id = String(params[0]);
    const completedAt = params[1] === null ? null : String(params[1]);
    const existingCompletedAt = this.appSettingsRow?.onboarding_completed_at ?? null;

    this.appSettingsRow = {
      evening_plan_prompt_dismissed_date_key:
        this.appSettingsRow?.evening_plan_prompt_dismissed_date_key ?? null,
      id,
      onboarding_completed_at: existingCompletedAt ?? completedAt,
      onboarding_mode: sql.includes("'plan_saved'") ? 'plan_saved' : 'tracking_only',
    };
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes('FROM target_day_plan')) {
      return this.hasActivePlan ? ({ id: 'active-plan' } as T) : null;
    }

    if (sql.includes('FROM app_settings')) {
      return this.appSettingsRow as T | null;
    }

    return null;
  }
}

function createFakeDatabase(): SQLiteDatabase & FakeAppSettingsDatabase {
  return new FakeAppSettingsDatabase() as SQLiteDatabase & FakeAppSettingsDatabase;
}

describe('app settings repository', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T05:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads clean onboarding state as not started', async () => {
    const db = createFakeDatabase();

    await expect(getOnboardingState(db)).resolves.toBe('not_started');
  });

  it('saves tracking-only onboarding choice', async () => {
    const db = createFakeDatabase();

    const settings = await completeOnboardingTrackingOnly(db);

    expect(settings).toMatchObject({
      onboardingCompletedAt: '2026-06-05T05:00:00.000Z',
      onboardingMode: 'tracking_only',
    });
    await expect(getOnboardingState(db)).resolves.toBe('tracking_only');
    expect(db.runSqls.join('\n')).not.toContain('INSERT INTO target_day_plan');
  });

  it('moves onboarding state to plan saved', async () => {
    const db = createFakeDatabase();

    await completeOnboardingTrackingOnly(db);
    vi.setSystemTime(new Date('2026-06-05T06:00:00.000Z'));

    const settings = await markOnboardingPlanSaved(db);

    expect(settings).toMatchObject({
      onboardingCompletedAt: '2026-06-05T05:00:00.000Z',
      onboardingMode: 'plan_saved',
    });
    await expect(getOnboardingState(db)).resolves.toBe('plan_saved');
  });

  it('derives plan saved for an old database with an active target day plan', async () => {
    const db = createFakeDatabase();
    db.hasActivePlan = true;

    await expect(getOnboardingState(db)).resolves.toBe('plan_saved');
  });
});
