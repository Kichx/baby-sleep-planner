import { describe, expect, it } from 'vitest';

import {
  APP_SETTINGS_STORAGE_SQL,
  DATABASE_VERSION,
  INITIAL_SCHEMA_SQL,
  SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL,
} from '@/db/schema';

describe('database schema', () => {
  it('contains the sleep day temporary mode table and unique index in the fresh schema', () => {
    expect(DATABASE_VERSION).toBe(16);
    expect(INITIAL_SCHEMA_SQL).toContain('bottle_feeding_top_up_threshold_ml INTEGER NOT NULL DEFAULT 30');
    expect(INITIAL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS sleep_day_temporary_mode');
    expect(INITIAL_SCHEMA_SQL).toContain('sleep_day_date_key TEXT NOT NULL');
    expect(INITIAL_SCHEMA_SQL).toContain("mode TEXT NOT NULL CHECK (mode IN ('soft_day', 'early_wake'))");
    expect(INITIAL_SCHEMA_SQL).toContain('base_plan_id TEXT NOT NULL');
    expect(INITIAL_SCHEMA_SQL).toContain('dismissed_at TEXT');
    expect(INITIAL_SCHEMA_SQL).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS sleep_day_temporary_mode_child_day_mode_idx',
    );
    expect(SLEEP_DAY_TEMPORARY_MODE_STORAGE_SQL).toContain(
      'ON sleep_day_temporary_mode(child_id, sleep_day_date_key, mode)',
    );
  });

  it('contains app settings onboarding storage in the fresh schema', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS app_settings');
    expect(INITIAL_SCHEMA_SQL).toContain('onboarding_completed_at TEXT');
    expect(INITIAL_SCHEMA_SQL).toContain(
      "onboarding_mode IS NULL OR onboarding_mode IN ('tracking_only', 'plan_saved')",
    );
    expect(INITIAL_SCHEMA_SQL).toContain('evening_plan_prompt_dismissed_date_key TEXT');
    expect(APP_SETTINGS_STORAGE_SQL).toContain('CREATE TABLE IF NOT EXISTS app_settings');
  });
});
